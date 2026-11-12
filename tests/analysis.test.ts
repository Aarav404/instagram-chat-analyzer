import { describe, expect, it } from 'vitest'
import { analyze } from '../src/core/analysis'
import { conversation, message, request, legacyCases } from './fixtures'
import golden from './legacy-golden.json'

describe('original Python calculation parity', () => {
  for (const [index, fixture] of legacyCases.entries()) it(fixture.name, () => {
    const req = request({ groupName: fixture.groupName })
    req.settings.calculationMode = 'legacy'; req.settings.ownerNames = fixture.owners || ['Me']
    const actual = analyze([{ conversation: conversation('chat-a', fixture.messages), messages: fixture.messages }], req)
    const expected = golden.cases[index]
    for (const key of ['total', 'engagement', 'delayScore', 'doubleTexts', 'doubleTextScore', 'initiations', 'initiationScore'] as const) expect(actual[key]).toBeCloseTo(expected[key], 8)
    if (expected.averageReplySeconds === null) expect(actual.averageReplySeconds).toBeNull()
    else expect(actual.averageReplySeconds).toBeCloseTo(expected.averageReplySeconds, 8)
    expect(actual.streak).toEqual(expected.streak)
    expect(actual.busiestDay).toEqual(expected.busiestDay)
    expect(actual.daily.map(({ date, count, average }) => ({ date, count, average }))).toEqual(expected.daily)
    for (const sender of actual.senders) {
      expect(sender.medianReplySeconds).toBe((expected.medians as unknown as Record<string, number | null>)[sender.name])
      expect(sender.doubleTexts).toBe((expected.senderDoubles as Record<string, number>)[sender.name] || 0)
      expect(sender.initiations).toBe((expected.senderInitiations as Record<string, number>)[sender.name] || 0)
    }
  })
})

describe('standard mode fixes and filtering', () => {
  it('summarizes call initiations and durations by sender and day', () => {
    const calls = [
      { ...message('Me', 0), kind: 'call' as const, callDurationSeconds: 60 },
      { ...message('Peer', 86400), kind: 'call' as const, callDurationSeconds: 120 },
      { ...message('Me', 172800), kind: 'call' as const },
      { ...message('Peer', null), kind: 'call' as const, callDurationSeconds: 0 },
    ]
    const actual = analyze([{ conversation: conversation('chat-a', calls), messages: calls }], request()).calls
    expect(actual.totalCalls).toBe(4)
    expect(actual.durationCount).toBe(3)
    expect(actual.totalDurationSeconds).toBe(180)
    expect(actual.averageDurationSeconds).toBe(60)
    expect(actual.senders).toEqual([
      { name: 'Me', calls: 2, durationCount: 1, totalDurationSeconds: 60, averageDurationSeconds: 60 },
      { name: 'Peer', calls: 2, durationCount: 2, totalDurationSeconds: 120, averageDurationSeconds: 60 },
    ])
    expect(actual.daily.map(({ date, sender, calls: count, totalDurationSeconds }) => [date, sender, count, totalDurationSeconds])).toEqual([
      ['2026-01-01', 'Me', 1, 60], ['2026-01-02', 'Peer', 1, 120], ['2026-01-03', 'Me', 1, 0],
    ])
  })
  it('recognizes and preserves common Hinglish compliment phrases for highlighting', () => {
    const messages = [message('Me', 0, 'chat-a', 'Tum bahut pyaari ho aur bohot smart ho')]
    const result = analyze([{ conversation: conversation('chat-a', messages), messages }], request()).compliments
    expect(result.total).toBe(2)
    expect(result.examples.map((example) => example.phrase)).toEqual(['tum bahut pyaari ho', 'bohot smart ho'])
    expect(result.senders[0].categories.Appearance).toBe(1)
    expect(result.senders[0].categories.Ability).toBe(1)
  })
  it('applies sender and date filters to call analytics and handles old call records without durations', () => {
    const calls = [{ ...message('Me', 0), kind: 'call' as const }, { ...message('Peer', 86400), kind: 'call' as const, callDurationSeconds: 30 }]
    const old = analyze([{ conversation: conversation('chat-a', [calls[0]]), messages: [calls[0]] }], request()).calls
    expect(old.durationCount).toBe(0)
    const req = request(); req.filters.sender = 'Peer'; req.filters.from = '2026-01-02'; req.filters.to = '2026-01-02'
    expect(analyze([{ conversation: conversation('chat-a', calls), messages: calls }], req).calls.totalCalls).toBe(1)
  })
  it('does not invent cross-thread replies or lose unreturned double texts', () => {
    const a = [message('Me', 0), message('Me', 1), message('Me', 2)]
    const b = [message('Peer', 3, 'chat-b'), message('Peer', 4, 'chat-b')]
    const actual = analyze([{ conversation: conversation('chat-a', a), messages: a }, { conversation: conversation('chat-b', b), messages: b }], request({ groupName: 'Combined' }))
    expect(actual.averageReplySeconds).toBeNull(); expect(actual.delayScore).toBeNull(); expect(actual.doubleTexts).toBe(3); expect(actual.initiations).toBe(2)
    expect(actual.shares.map((s) => [s.name, s.count])).toEqual([['You', 3], ['Combined', 2]])
  })
  it('flushes double texts across session boundaries', () => {
    const messages = legacyCases[1].messages
    const actual = analyze([{ conversation: conversation('chat-a', messages), messages }], request())
    expect(actual.doubleTexts).toBe(3)
  })
  it('fills calendar gaps in the seven-day average', () => {
    const messages = [message('Me', 0), message('Peer', 86400 * 2)]
    const actual = analyze([{ conversation: conversation('chat-a', messages), messages }], request())
    expect(actual.daily.map((d) => d.count)).toEqual([1, 0, 1]); expect(actual.daily[2].average).toBeCloseTo(2 / 3); expect(actual.streak.days).toBe(1)
  })
  it('ignores Meta AI in every derived metric and counts undated human messages', () => {
    const messages = [message('Me', 0), message('Meta AI', 1, 'chat-a', 'forbidden'), message('Peer', null), message('Meta AI assistant', 2)]
    const actual = analyze([{ conversation: conversation('chat-a', messages), messages }], request())
    expect(actual.total).toBe(2); expect(actual.datedTotal).toBe(1); expect(actual.senders.map((s) => s.name)).not.toContain('Meta AI'); expect(actual.topWords.map((w) => w.name)).not.toContain('forbidden')
    expect(actual.heatmap.reduce((sum, item) => sum + item[2], 0)).toBe(1)
  })
  it('applies source, date, sender, and case-insensitive content filters', () => {
    const messages = [message('Me', 0, 'chat-a', 'Coffee!'), message('Peer', 86400, 'chat-a', 'tea')]
    const req = request(); req.filters.from = '2026-01-01'; req.filters.to = '2026-01-01'; req.filters.sender = 'Me'; req.filters.query = 'COFFEE'
    expect(analyze([{ conversation: conversation('chat-a', messages), messages }], req).total).toBe(1)
    req.filters.platform = 'whatsapp'; expect(analyze([{ conversation: conversation('chat-a', messages), messages }], req).total).toBe(0)
  })
  it('returns every group participant and handles empty results', () => {
    const messages = legacyCases[6].messages
    const actual = analyze([{ conversation: conversation('chat-a', messages), messages }], request())
    expect(actual.shares).toHaveLength(5)
    expect(analyze([], request())).toMatchObject({ total: 0, streak: { days: 0 }, engagement: null, daily: [] })
  })
  it('keeps duplicate titles distinct in ranking', () => {
    const a = [message('Me', 0)], b = [message('Peer', 5, 'b')]
    const actual = analyze([{ conversation: conversation('a', a, 'Same'), messages: a }, { conversation: conversation('b', b, 'Same'), messages: b }], request())
    expect(actual.threads).toHaveLength(2)
  })
})
