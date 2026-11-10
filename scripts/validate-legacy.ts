/** Developer-only parity runner. The product and regular test suite require no Python. */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { analyze } from '../src/core/analysis'
import { conversation, legacyCases, request } from '../tests/fixtures'

const source = execFileSync('git', ['show', 'f7ad309:2_📊_Statistics.py'], { encoding: 'utf8' })
const python = process.env.PYTHON || (existsSync('.venv/bin/python') ? '.venv/bin/python' : 'python3')
const oracle = String.raw`
import json, sys, textwrap, statistics
from collections import Counter
from datetime import datetime, timedelta
data = json.load(sys.stdin)
source = data['source']
def block(start, end):
    return textwrap.dedent(source[source.index(start):source.index(end)])
summary = block('            dated.sort(key=lambda item:', '            c1.metric("Total messages"')
patterns = block('            sender_delays = Counter()', '            pattern_cols = st.columns(4)')
output = []
for case in data['cases']:
    msgs = [{'sender_name': m['sender'], 'timestamp_ms': m['timestamp']} for m in case['messages']]
    env = {'msgs': msgs, 'dated': [(datetime.fromtimestamp(m['timestamp_ms']/1000), m['sender_name']) for m in msgs], 'Counter': Counter, 'datetime': datetime, 'timedelta': timedelta}
    exec(summary, env)
    exec(patterns, env)
    counts = Counter(m['sender_name'] for m in msgs)
    owners = set(case.get('owners', ['Me']))
    if case.get('groupName') or len(counts) <= 2:
        own = sum(n for s,n in counts.items() if s in owners)
        share_counts = [n for n in (own, len(msgs)-own) if n]
    else:
        share_counts = list(counts.values())
    daily = sorted((str(d), n) for d,n in env['daily'].items())
    rolling = [sum(n for _,n in daily[max(0,i-6):i+1])/len(daily[max(0,i-6):i+1]) for i in range(len(daily))]
    ordered = env['ordered']
    medians = {}
    for sender in counts:
        delays = [(ordered[i]['timestamp_ms']-ordered[i-1]['timestamp_ms'])/1000 for i in range(1,len(ordered)) if ordered[i]['sender_name']==sender and ordered[i-1]['sender_name']!=sender]
        delays = [d for d in delays if 0 <= d <= 7*24*60*60]
        medians[sender] = statistics.median(delays) if delays else None
    samples = env['delay_samples']
    avg_delay = sum(samples)/len(samples) if samples else 0
    doubles = sum(env['sender_double_texts'].values())
    starts = sum(env['sender_initiations'].values())
    output.append({'name':case['name'], 'total':len(msgs), 'averageReplySeconds':env['avg_reply_minutes']*60 if env['avg_reply_minutes'] is not None else None, 'streak':{'days':env['longest'],'start':str(env['best_start']),'end':str(env['best_end'])}, 'busiestDay':{'date':str(max(env['daily'],key=env['daily'].get)), 'count':max(env['daily'].values())}, 'daily': [{'date':d,'count':n,'average':rolling[i]} for i,(d,n) in enumerate(daily)], 'engagement':min(share_counts)/max(share_counts)*100 if len(share_counts)>1 else 100, 'delayScore':max(0,100-avg_delay/60), 'doubleTexts':doubles,'doubleTextScore':min(100,doubles/max(len(ordered),1)*100), 'initiations':starts, 'initiationScore':min(100,starts/max(len(ordered),1)*100), 'medians':medians, 'senderDoubles':dict(env['sender_double_texts']), 'senderInitiations':dict(env['sender_initiations'])})
print(json.dumps(output))
`
const result = spawnSync(python, ['-c', oracle], { input: JSON.stringify({ source, cases: legacyCases }), encoding: 'utf8', env: { ...process.env, TZ: 'UTC' } })
if (result.status !== 0) throw new Error(result.stderr)
const expected = JSON.parse(result.stdout) as Record<string, unknown>[]
// Capture versioned synthetic outputs so npm test never depends on Python.
writeFileSync('tests/legacy-golden.json', JSON.stringify({ baseline: 'f7ad309', timezone: 'UTC', cases: expected }, null, 2) + '\n')
let checked = 0
for (const [i, fixture] of legacyCases.entries()) {
  const req = request({ groupName: fixture.groupName })
  req.settings.calculationMode = 'legacy'
  req.settings.ownerNames = fixture.owners || ['Me']
  const stats = analyze([{ conversation: conversation('chat-a', fixture.messages), messages: fixture.messages }], req)
  for (const field of ['total', 'averageReplySeconds', 'engagement', 'delayScore', 'doubleTexts', 'doubleTextScore', 'initiations', 'initiationScore'] as const) {
    const actual = stats[field], want = expected[i][field]
    if (typeof actual === 'number' && typeof want === 'number' ? Math.abs(actual - want) > 1e-7 : actual !== want) throw new Error(`${fixture.name}: ${field}: ${actual} != ${want}`)
    checked++
  }
}
console.log(`Python parity: ${legacyCases.length} synthetic cases, ${checked} scalar comparisons passed. Golden outputs captured.`)
