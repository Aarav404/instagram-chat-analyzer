import json
import re
import io
import zipfile
from pathlib import Path
from collections import Counter
from datetime import datetime, timedelta

import pandas as pd
import streamlit as st
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap


st.set_page_config(page_title="aaloe-lyzer", page_icon="📊", layout="wide")
st.logo("logo.png")
st.title("aaloe-lyzer")
st.write("Explore your conversations, create groups for alternate accounts, and view combined stats.")

st.write("Upload your Instagram data export ZIP. The app finds conversation JSON files under `messages/inbox` inside the archive; media files are ignored.")
uploaded_zip = st.file_uploader("Choose Instagram export (.zip)", type=["zip"])
whatsapp_files = st.file_uploader("Add WhatsApp chat export (.txt)", type=["txt"], accept_multiple_files=True)


def parse_whatsapp(file):
    # WhatsApp exports use one timestamped line per message; continuation lines
    # belong to the preceding message. Accept both 12-hour and 24-hour clocks.
    pattern = re.compile(r"^\[([\d/]+),\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[APMapm]*)\]\s*(.*?):\s?(.*)$")
    messages = []
    current = None
    for line in file.getvalue().decode("utf-8-sig", errors="replace").splitlines():
        match = pattern.match(line)
        if match:
            if current:
                messages.append(current)
            date_text, time_text, sender, content = match.groups()
            time_text = " ".join(time_text.replace("\u202f", " ").split())
            parsed = None
            for fmt in ("%d/%m/%y, %I:%M:%S %p", "%d/%m/%y, %I:%M %p", "%d/%m/%y, %H:%M:%S", "%d/%m/%y, %H:%M"):
                try:
                    parsed = datetime.strptime(f"{date_text}, {time_text}", fmt)
                    break
                except ValueError:
                    pass
            if parsed:
                current = {"sender_name": sender.strip(), "timestamp_ms": int(parsed.timestamp() * 1000), "content": content.strip()}
        elif current and line.strip():
            current["content"] += "\n" + line
    if current:
        messages.append(current)
    if not messages:
        st.warning(f"No timestamped WhatsApp messages found in {file.name}.")
        return None
    participants = sorted({m["sender_name"] for m in messages})
    other = Path(file.name).stem
    return {"name": f"{other} (WhatsApp)", "messages": messages, "participants": participants}

def load_conversation(file):
    try:
        data = json.load(file)
        messages = data.get("messages", [])
        people = [p.get("name", "Unknown") for p in data.get("participants", [])]
        if not messages:
            return None
        names = sorted({m.get("sender_name", "Unknown") for m in messages} | set(people))
        # Instagram exports identify a conversation by title and participant list.
        # For one-to-one chats, show the other participant rather than the export owner.
        title = data.get("title")
        peer = next((n for n in names if n != "Unknown"), None)
        return {"name": title or peer or "Unknown", "messages": messages, "participants": names}
    except (json.JSONDecodeError, AttributeError, TypeError) as exc:
        st.warning(f"Could not read {file.name}: {exc}")
        return None


if uploaded_zip or whatsapp_files:
    conversations = {}
    if uploaded_zip:
        try:
            with zipfile.ZipFile(io.BytesIO(uploaded_zip.getvalue())) as archive:
                file_names = sorted(n for n in archive.namelist() if "/messages/inbox/" in n and Path(n).name.startswith("message_") and n.endswith(".json"))
                if not file_names:
                    st.error("This ZIP has no conversation JSON files under messages/inbox.")
                for file_name in file_names:
                    try:
                        data = json.loads(archive.read(file_name).decode("utf-8"))
                        conversation = load_conversation(io.StringIO(json.dumps(data)))
                    except (UnicodeDecodeError, json.JSONDecodeError, KeyError) as exc:
                        st.warning(f"Could not read {Path(file_name).name}: {exc}")
                        continue
                    if conversation:
                        key = conversation["name"]
                        entry = conversations.setdefault(key, {"messages": [], "participants": set()})
                        entry["messages"].extend(conversation["messages"])
                        entry["participants"].update(conversation["participants"])
        except (zipfile.BadZipFile, OSError) as exc:
            st.error(f"Could not open ZIP file: {exc}")

    for file in whatsapp_files or []:
        conversation = parse_whatsapp(file)
        if conversation:
            entry = conversations.setdefault(conversation["name"], {"messages": [], "participants": set()})
            entry["messages"].extend(conversation["messages"])
            entry["participants"].update(conversation["participants"])

    # Ignore Meta AI messages and participants consistently across every view.
    for conversation in conversations.values():
        conversation["messages"] = [
            message for message in conversation["messages"]
            if "meta ai" not in str(message.get("sender_name", "")).casefold()
        ]
        conversation["participants"] = {
            participant for participant in conversation["participants"]
            if "meta ai" not in participant.casefold()
        }
    conversations = {
        name: conversation for name, conversation in conversations.items()
        if conversation["messages"]
    }

    if conversations:
        names = sorted(conversations)
        sender_frequency = Counter(
            sender
            for conversation in conversations.values()
            for sender in conversation["participants"]
        )
        sender_options = sorted(sender_frequency)
        likely_owner = max(sender_options, key=sender_frequency.get) if sender_options else None
        default_owner_names = [likely_owner] if likely_owner else []
        own_senders = st.multiselect(
            "Which participant names are yours?",
            sender_options,
            default=default_owner_names,
            help="Select every name or alternate account that belongs to you. This keeps grouped sender shares accurate.",
        )
        group_file = Path(__file__).resolve().parent / ".chat_groups.json"
        try:
            groups = json.loads(group_file.read_text(encoding="utf-8")) if group_file.exists() else {}
        except (json.JSONDecodeError, OSError):
            groups = {}

        with st.expander("👥 Make or edit groups", expanded=False):
            group_name = st.text_input("Group name", placeholder="e.g. Alex")
            members = st.multiselect("Add members", names, key="group_members")
            if st.button("Finalize group", type="primary"):
                if not group_name.strip() or not members:
                    st.error("Enter a group name and select at least one chat.")
                else:
                    groups[group_name.strip()] = members
                    group_file.write_text(json.dumps(groups, indent=2), encoding="utf-8")
                    st.success(f"Saved group {group_name.strip()}.")
                    st.rerun()
            if groups:
                remove_group = st.selectbox("Remove a saved group", ["—"] + sorted(groups))
                if remove_group != "—" and st.button("Remove group"):
                    del groups[remove_group]
                    group_file.write_text(json.dumps(groups, indent=2), encoding="utf-8")
                    st.rerun()

        views = {name: [name] for name in names}
        for group, members in groups.items():
            valid = [m for m in members if m in conversations]
            if valid:
                views[f"{group} (group)"] = valid

        def messages_for(member_names):
            return [m for member in member_names for m in conversations[member]["messages"]]

        rows = []
        for name, member_names in views.items():
            msgs = messages_for(member_names)
            stamps = [m["timestamp_ms"] for m in msgs if isinstance(m.get("timestamp_ms"), (int, float))]
            rows.append({"Person / group": name, "Accounts": len(member_names), "Messages": len(msgs), "Last active": datetime.fromtimestamp(max(stamps) / 1000).strftime("%Y-%m-%d") if stamps else "—"})
        overview = pd.DataFrame(rows).sort_values("Messages", ascending=False)
        st.subheader("Who you talked to most")
        st.dataframe(overview, hide_index=True, use_container_width=True)
        st.bar_chart(overview.set_index("Person / group")["Messages"])
        selected = st.selectbox("View full stats for", list(views))
        member_names = views[selected]
        msgs = messages_for(member_names)
        sender_counts = Counter(m.get("sender_name", "Unknown") for m in msgs)
        account_counts = Counter({name: len(conversations[name]["messages"]) for name in member_names})
        dated = []
        for m in msgs:
            try:
                dated.append((datetime.fromtimestamp(m["timestamp_ms"] / 1000), m.get("sender_name", "Unknown")))
            except (KeyError, TypeError, ValueError, OSError):
                continue
        st.subheader(f"Stats with {selected}")
        sent_counts = Counter(m.get("sender_name", "Unknown") for m in msgs)
        own_sender_set = set(own_senders)
        own_count = sum(count for sender, count in sent_counts.items() if sender in own_sender_set)
        c1, c2, c3, c4 = st.columns(4)
        if dated:
            dated.sort(key=lambda item: item[0])
            daily = Counter(dt.date() for dt, _ in dated)
            active_dates = sorted({dt.date() for dt, _ in dated})
            longest = current = 1
            start = best_start = active_dates[0]
            best_end = active_dates[0]
            for prev, day in zip(active_dates, active_dates[1:]):
                if day == prev + timedelta(days=1):
                    current += 1
                else:
                    if current > longest:
                        longest, best_start, best_end = current, start, prev
                    current, start = 1, day
            if current > longest:
                longest, best_start, best_end = current, start, active_dates[-1]
            ordered = [m for _, m in sorted(
                ((datetime.fromtimestamp(m["timestamp_ms"] / 1000), m)
                 for m in msgs if isinstance(m.get("timestamp_ms"), (int, float))),
                key=lambda item: item[0]
            )]
            reply_gaps = []
            previous = None
            for message in ordered:
                sender = message.get("sender_name", "Unknown")
                timestamp = message.get("timestamp_ms", 0) / 1000
                if previous and sender != previous[0]:
                    gap = timestamp - previous[1]
                    if 0 <= gap <= 7 * 24 * 60 * 60:
                        reply_gaps.append(gap)
                previous = (sender, timestamp)
            avg_reply_minutes = sum(reply_gaps) / len(reply_gaps) / 60 if reply_gaps else None
            c1.metric("Total messages", f"{len(msgs):,}")
            c2.metric("Busiest day", max(daily, key=daily.get).strftime("%b %d"), help=f"{max(daily.values())} messages")
            c3.metric("Longest active streak", f"{longest} days", help=f"{best_start} to {best_end}")
            c4.metric("Average reply time", f"{avg_reply_minutes / 60:.1f} hours" if avg_reply_minutes is not None and avg_reply_minutes >= 60 else (f"{avg_reply_minutes:.1f} min" if avg_reply_minutes is not None else "—"))

            st.write("**Daily activity**")
            daily_series = pd.Series(daily, dtype="int64").sort_index()
            daily_frame = daily_series.rename("Messages").to_frame()
            daily_frame["7-day average"] = daily_series.rolling(7, min_periods=1).mean()
            st.line_chart(daily_frame)
            st.caption(f"{active_dates[0]} to {active_dates[-1]} · 7-day average smooths the daily message count")

            st.write("**Who sent the messages**")
            is_custom_group = selected.endswith(" (group)")
            is_multi_person_chat = len(conversations[member_names[0]]["participants"]) > 2 if len(member_names) == 1 else False
            if is_custom_group:
                you_count = sum(n for sender, n in sent_counts.items() if sender in own_sender_set)
                other_count = sum(n for sender, n in sent_counts.items() if sender not in own_sender_set and "meta ai" not in sender.casefold())
                share_counts = Counter({"You": you_count, "Other sender": other_count})
            elif is_multi_person_chat:
                share_counts = Counter({s: n for s, n in sent_counts.items() if "meta ai" not in s.casefold()})
            else:
                other_count = sum(n for sender, n in sent_counts.items() if sender not in own_sender_set and "meta ai" not in sender.casefold())
                share_counts = Counter({"You": own_count, "Other person": other_count})
            share_counts = Counter({s: n for s, n in share_counts.items() if n > 0})
            if share_counts:
                cols = st.columns(min(len(share_counts), 4))
                total_share = sum(share_counts.values()) or 1
                palette = ["#a3e635", "#60a5fa", "#fb923c", "#c084fc", "#f472b6", "#2dd4bf"]
                for i, (col, (label, count)) in enumerate(zip(cols, share_counts.items())):
                    percentage = count / total_share * 100
                    fig, ax = plt.subplots(figsize=(1.25, 1.25), dpi=110)
                    fig.patch.set_alpha(0)
                    ax.pie(
                        [percentage, 100 - percentage],
                        startangle=90,
                        colors=[palette[i % len(palette)], "#44474b"],
                        wedgeprops={"width": 0.11, "edgecolor": "none"},
                    )
                    ax.text(0, 0, f"{percentage:.0f}%", ha="center", va="center", color="white", fontsize=11, fontweight="bold")
                    ax.set(aspect="equal")
                    ax.axis("off")
                    col.markdown(f"**{label}**")
                    col.pyplot(fig, use_container_width=False)
                    col.caption(f"{count:,} messages")
                    plt.close(fig)

            st.write("**Conversation patterns**")
            sender_delays = Counter()
            sender_double_texts = Counter()
            sender_initiations = Counter()
            delay_samples = []
            last_timestamp = None
            pending_sender = None
            pending_count = 0
            session_gap = 6 * 60 * 60
            for message in ordered:
                sender = message.get("sender_name", "Unknown")
                timestamp = message.get("timestamp_ms", 0) / 1000
                if last_timestamp is None or timestamp - last_timestamp > session_gap:
                    sender_initiations[sender] += 1
                    pending_sender, pending_count = sender, 1
                elif sender == pending_sender:
                    pending_count += 1
                else:
                    if pending_count > 1:
                        sender_double_texts[pending_sender] += pending_count - 1
                    delay = timestamp - last_timestamp
                    if 0 <= delay <= 7 * 24 * 60 * 60:
                        sender_delays[sender] += 1
                        delay_samples.append(delay)
                    pending_sender, pending_count = sender, 1
                last_timestamp = timestamp
            if pending_count > 1:
                sender_double_texts[pending_sender] += pending_count - 1

            pattern_cols = st.columns(4)
            engagement = (min(share_counts.values()) / max(share_counts.values()) * 100) if len(share_counts) > 1 and max(share_counts.values()) else 100
            avg_delay = sum(delay_samples) / len(delay_samples) if delay_samples else 0
            pattern_values = [
                ("Engagement", engagement, f"{engagement:.0f}%"),
                ("Delay score", max(0, 100 - avg_delay / 60), f"{avg_delay / 60:.1f} min avg" if delay_samples else "No replies"),
                ("Double texts", min(100, sum(sender_double_texts.values()) / max(len(ordered), 1) * 100), f"{sum(sender_double_texts.values()):,}"),
                ("Initiations", min(100, sum(sender_initiations.values()) / max(len(ordered), 1) * 100), f"{sum(sender_initiations.values()):,}"),
            ]
            for col, (label, score, value_text), color in zip(pattern_cols, pattern_values, palette):
                descriptions = {
                    "Engagement": "Compares message counts between participants. 100% means the counts are equal; lower percentages mean one side sent more messages.",
                    "Initiations": "Counts who sent the first message in each conversation session. A new session begins after six hours without a message.",
                }
                if label in descriptions:
                    col.metric(label, "", help=descriptions[label])
                else:
                    col.markdown(f"**{label}**")
                score = max(0, min(100, score))
                fig, ax = plt.subplots(figsize=(1.15, 1.15), dpi=110)
                fig.patch.set_alpha(0)
                ax.pie([score, 100 - score], startangle=90, colors=[color, "#44474b"], wedgeprops={"width": 0.12, "edgecolor": "none"})
                ax.text(0, 0, f"{score:.0f}%", ha="center", va="center", color="white", fontsize=10, fontweight="bold")
                ax.axis("off")
                col.pyplot(fig, use_container_width=False)
                if label not in descriptions:
                    col.caption(value_text)
                plt.close(fig)

            pattern_names = sorted(set(sender_delays) | set(sender_double_texts) | set(sender_initiations))
            if pattern_names:
                pattern_rows = []
                for sender in pattern_names:
                    delay_values = [
                        (datetime.fromtimestamp(ordered[i]["timestamp_ms"] / 1000) - datetime.fromtimestamp(ordered[i - 1]["timestamp_ms"] / 1000)).total_seconds()
                        for i in range(1, len(ordered))
                        if ordered[i].get("sender_name") == sender
                        and ordered[i - 1].get("sender_name") != sender
                    ]
                    delay_values = [d for d in delay_values if 0 <= d <= 7 * 24 * 60 * 60]
                    pattern_rows.append({
                        "Sender": sender,
                        "Median reply delay": f"{pd.Series(delay_values).median() / 60:.1f} min" if delay_values else "—",
                        "Double texts": sender_double_texts[sender],
                        "Conversations started": sender_initiations[sender],
                    })
                st.dataframe(pd.DataFrame(pattern_rows), hide_index=True, use_container_width=True)

            st.write("**Activity by hour and day**")
            heat = Counter((dt.weekday(), dt.hour) for dt, _ in dated)
            heat_df = pd.DataFrame(
                [[heat[(day, hour)] for hour in range(24)] for day in range(7)],
                index=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                columns=[f"{hour % 12 or 12}{'am' if hour < 12 else 'pm'}" for hour in range(24)],
            )
            heatmap_colors = LinearSegmentedColormap.from_list(
                "dark_to_blue", ["#171a20", "#123c64", "#168bd2", "#9adcf5"]
            )
            st.dataframe(
                heat_df.style.background_gradient(cmap=heatmap_colors),
                use_container_width=True,
            )
        else:
            c1.metric("Total messages", f"{len(msgs):,}")
    else:
        st.info("No conversations were found. Upload an Instagram export ZIP or a WhatsApp text export.")
else:
    st.info("Upload an Instagram export ZIP or WhatsApp text export to get started.")

st.markdown(
    "<div style='display:flex; align-items:center; gap:0.8rem; color:#9298a1; font-size:0.78rem; padding:1.5rem 0 0.5rem;'><span style='flex:1; height:1px; background:#555b64;'></span><span style='white-space:nowrap;'>Made by Aaloe</span><span style='flex:1; height:1px; background:#555b64;'></span></div>",
    unsafe_allow_html=True,
)
