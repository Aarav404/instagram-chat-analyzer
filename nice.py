import json
import statistics
from datetime import datetime
import streamlit as st
import emoji
import pandas as pd
from collections import defaultdict

def process_messages(messages, participants):
    """Processes the messages data and extracts statistics."""
    count = len(messages)
    chat = ""
    person1 = 0
    person2 = 0
    dates = []

    if len(participants) < 2:
        return [], count, 0, 0, dates, "N/A", "N/A"

    # Normalize participant names for consistent comparison
    participant1 = participants[0].encode('latin-1', 'ignore').decode('utf-8')
    participant2 = participants[1].encode('latin-1', 'ignore').decode('utf-8')

    for msg in messages:
        try:
            text = msg.get("content", "")
            decoded_text = text.encode('latin-1', 'ignore').decode('utf-8')
            emoji_text = emoji.emojize(decoded_text)

            username = msg["sender_name"]
            decoded_username = username.encode('latin-1', 'ignore').decode('utf-8')
            emoji_username = emoji.emojize(decoded_username)

            ts = msg["timestamp_ms"]
            timestamp_sec = ts / 1000
            dates.append(datetime.fromtimestamp(timestamp_sec).strftime("%d-%m-%Y"))

            # Compare after normalizing names
            if emoji_username == participant1:
                person1 += 1
            elif emoji_username == participant2:
                person2 += 1

            chat += " " + emoji_text

        except Exception as e:
            print(f"Error processing message: {e}")

    words = chat.split()
    mode_word = statistics.mode(words) if words else "N/A"
    mode_date = statistics.mode(dates) if dates else "N/A"

    return words, count, person1, person2, dates, mode_word, mode_date


# Streamlit UI
st.set_page_config(
    page_title="Home - Chat Stats",
    page_icon="🏠"
)

st.write("# Instagram Chat Analyzer")
st.write("**Upload your JSON message files here:**")

uploaded_files = st.file_uploader("Choose JSON files", type='json', accept_multiple_files=True)

if uploaded_files:
    messages = []
    participants = set()

    for file in uploaded_files:
        try:
            data = json.load(file)
            messages.extend(data.get("messages", []))
            for participant in data.get("participants", []):
                participants.add(participant["name"])
        except json.JSONDecodeError:
            st.error(f"Error decoding JSON from {file.name}")

    participants = list(participants)

    if messages:
        words, count, person1, person2, dates, mode_word, mode_date = process_messages(messages, participants)

        # st.markdown(f"""
        # **Total Messages:** {count}
        # **Messages by {participants[0]}:** {person1}
        # **Messages by {participants[1]}:** {person2}
        # **Most Used Word:** {mode_word}
        # **Most Active Date:** {mode_date} ({dates.count(mode_date)} messages)
        # """)



        # Organize messages by date and sender
        date_sender_counts = defaultdict(lambda: defaultdict(int))

        for msg in messages:
            date = datetime.fromtimestamp(msg["timestamp_ms"] / 1000).strftime("%Y-%m-%d")

            try:
                sender = msg["sender_name"].encode('latin-1', 'ignore').decode('utf-8')
            except (UnicodeDecodeError, AttributeError):
                sender = msg["sender_name"]

            date_sender_counts[date][sender] += 1

        df = pd.DataFrame.from_dict(date_sender_counts, orient="index").fillna(0)

        st.bar_chart(df)
