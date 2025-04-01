import streamlit as st
from wordcloud import WordCloud
import matplotlib.pyplot as plt
from collections import Counter
import emoji

st.set_page_config(
    page_title="Word cloud",
    page_icon="☁",
    layout="wide"
)
st.logo("logo.png")
# Ensure that the words are processed with emojis if necessary
if 'words' in st.session_state:
    words = [emoji.emojize(word) for word in st.session_state['words']]


def generate_wordcloud(words):
    word_counts = Counter(words)  # Count word frequencies
    wordcloud = WordCloud(width=800, height=400, background_color=None, mode="RGBA").generate_from_frequencies(
        word_counts)

    # Display in Streamlit
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.imshow(wordcloud, interpolation="bilinear")
    ax.axis("off")  # Hide axes
    fig.patch.set_alpha(0)  # Make the background transparent

    st.pyplot(fig)

if 'words' in st.session_state:
    generate_wordcloud(words)
    if st.button(":material/restart_alt: Reset Wordcloud"):
        st.session_state.clear()
else:
    st.write("# No words found, please upload files in statistics")
    if st.button("📊 Statistics"):
        st.switch_page('2_📊_Statistics.py')
