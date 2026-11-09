import json
import re
import io
import zipfile
from pathlib import Path
from collections import Counter
from datetime import datetime, timedelta

import pandas as pd
import streamlit as st


st.set_page_config(page_title="Instagram Chat Analysis", page_icon="📊", layout="wide")
st.logo("logo.png")
st.title("🔍 Instagram chat analysis")
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

    if conversations:
        names = sorted(conversations)
        sender_frequency = Counter(
            sender
            for conversation in conversations.values()
            for sender in conversation["participants"]
        )
        sender_options = sorted(sender_frequency)
        likely_owner = max(sender_options, key=sender_frequency.get) if sender_options else None
        own_sender = st.selectbox(
            "Which participant name is yours?",
            sender_options,
            index=sender_options.index(likely_owner) if likely_owner else 0,
            help="Choose the name you use in these exports. It is used to calculate your message count and share.",
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
        own_count = sent_counts.get(own_sender, 0)
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total messages", f"{len(msgs):,}")
        c2.metric("Your messages", f"{own_count:,}")
        c3.metric("Messages by other accounts", f"{len(msgs) - own_count:,}")
        c4.metric("Your share", f"{own_count / len(msgs) * 100:.1f}%" if msgs else "0%")
        if dated:
            daily = Counter(dt.strftime("%Y-%m-%d") for dt, _ in dated)
            st.metric("Most active day", max(daily, key=daily.get), help=f"{max(daily.values())} messages")
            st.line_chart(pd.Series(daily).sort_index())
            st.caption(f"Conversation spans {min(dt for dt, _ in dated).date()} to {max(dt for dt, _ in dated).date()}")
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
            st.metric("Longest daily messaging streak", f"{longest} days", help=f"{best_start} to {best_end}")
            times = sorted(dt for dt, _ in dated)
            gaps = [(b - a).total_seconds() for a, b in zip(times, times[1:]) if b > a]
            if gaps:
                avg_minutes = sum(gaps) / len(gaps) / 60
                st.metric("Average time between messages", f"{avg_minutes / 60:.1f} hours" if avg_minutes >= 60 else f"{avg_minutes:.1f} minutes")
        st.write("**Messages by account**")
        st.bar_chart(pd.Series(account_counts))
        st.write("**Messages by sender**")
        sender_counts = Counter({
            sender: count
            for sender, count in sender_counts.items()
            if "meta ai" not in sender.casefold()
        })
        if sender_counts:
            st.bar_chart(pd.Series(sender_counts))
    else:
        st.info("No conversations were found. Upload an Instagram export ZIP or a WhatsApp text export.")
else:
    st.info("Upload an Instagram export ZIP or WhatsApp text export to get started.")
