import json
import statistics
from datetime import datetime
import streamlit as st
import emoji
import pandas as pd
from collections import defaultdict
import matplotlib.pyplot as plt
from docutils.parsers.rst.directives import percentage


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


st.set_page_config(
    page_title="Home - Chat Stats",
    page_icon="🏠",
    layout="wide"
)
st.logo(image='logo.png')


st.write('# 🔍 Instagram chat Analysis\n---\n ### To know how to retrieve your instagram chat files go to the guide')
if st.button("🧾 Guide"):
    st.switch_page('pages/1_🧾_Guide.py')

st.write('---\nUpload JSON files of the chat your want to analyse here')
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
        st.divider()
        col1, col2, col3 = st.columns(3, border=True)
        with col1:
            st.write(f"## Total messages\n---\n### {"{:,}".format(count)}")
        with col2:
            st.write(
                f"## Messages by {participants[0].encode('latin-1').decode('utf-8')}\n---\n### {"{:,}".format(person1)}")
        with col3:
            st.write(
                f"## Messages by {participants[1].encode('latin-1').decode('utf-8')}\n---\n### {"{:,}".format(person2)}")

        col4, col5, col6 = st.columns(3, border=True)
        with col4:
            st.write(f'## Date most talked on\n---\n### {mode_date}')

        with col5:
            st.write(f'## {participants[0].encode('latin-1').decode('utf-8')}\'s share\n---')
            percentagecol1,textcol1 = st.columns(2)
            with percentagecol1:
                person1percentage = round(person1 / count * 100)

                fig, ax = plt.subplots(figsize=(0.8, 0.8), dpi=500)
                fig.patch.set_alpha(0)
                ax.pie([person1percentage, 100 - person1percentage],
                       colors=["#A3E635", "white"],
                       startangle=90,
                       wedgeprops={"width": 0.2})
                ax.text(0, 0, f"{person1percentage}%",
                        ha="center", va="center", fontsize=5, fontweight="bold", color="white")
                ax.set_xticks([])
                ax.set_yticks([])
                ax.set_frame_on(False)
                st.pyplot(fig, use_container_width=False)
            with textcol1:
                st.write(f'### of messages were sent by {participants[0].encode('latin-1').decode('utf-8')}')

        with col6:
            st.write(f'## {participants[1].encode('latin-1').decode('utf-8')}\'s share\n---')
            percentagecol1,textcol1 = st.columns(2)
            with percentagecol1:
                person2percentage = round(person2 / count * 100)

                fig, ax = plt.subplots(figsize=(0.8, 0.8), dpi=500)
                fig.patch.set_alpha(0)
                ax.pie([person2percentage, 100 - person2percentage],
                       colors=["#A3E635", "white"],
                       startangle=90,
                       wedgeprops={"width": 0.2})
                ax.text(0, 0, f"{person2percentage}%",
                        ha="center", va="center", fontsize=5, fontweight="bold", color="white")
                ax.set_xticks([])
                ax.set_yticks([])
                ax.set_frame_on(False)
                st.pyplot(fig, use_container_width=False)
            with textcol1:
                st.write(f'### of messages were sent by {participants[1].encode('latin-1').decode('utf-8')}')

        st.write('---\n## Lifetime Activity')
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
