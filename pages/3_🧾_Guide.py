import streamlit as st

st.set_page_config(
    page_title="Guide",
    page_icon=":material/developer_guide:",
    layout="wide"
)

st.logo("logo.png")

st.write('# 📥 How to Download Your Instagram Chat Files')
st.write("Follow these steps to retrieve your Instagram messages for analysis.")
st.divider()

st.write('''## 1️⃣ Request Your Instagram Data
1. Open [Instagram's Download Page ↗](https://accountscenter.instagram.com/info_and_permissions/) and log in.
2. Click **Request a download**.''')
st.image('https://app.doubletext.me/onboarding/messenger/0-messenger.png', width=450)
st.divider()

st.write('''## 2️⃣ Select Data to Download
1. Choose the types of information to export.
2. Make sure to select **Messages** and click **Next**.''')
st.image('https://app.doubletext.me/onboarding/messenger/3-messenger.png', width=450)
st.divider()

st.write('''## 3️⃣ Set File Preferences
Select the following options:''')
col1, col2, col3 = st.columns(3, border=True)
with col1:
    st.write('📅 Date Range: **All time**')
with col2:
    st.write('📂 Format: **JSON**')
with col3:
    st.write('🖼️ Media Quality: **Low**')
st.write(
    '- Make sure to **Save** each setting before proceeding.\n- You can select a shorter date range for a faster download.')
st.image('https://app.doubletext.me/onboarding/messenger/4-messenger.png', width=450)
st.divider()

st.write('''## 4️⃣ Download Your Files
1. Instagram will process your request and email you when your files are ready (this may take a few hours).
2. Open [Instagram's Download Page](https://accountscenter.instagram.com/info_and_permissions/) again and click **Download**.''')
st.image('https://app.doubletext.me/onboarding/messenger/5-messenger.png''', width=450)
st.divider()

st.write('''## 5️⃣ Locate Your Conversation Files
1. **Unzip** the downloaded folder.
2. Navigate to: `your_instagram_activity/messages/inbox/`
3. Find the folder for the conversation you want to analyze.
4. Open the folder and upload **message_1.json** (and any additional message files) on the Statistics page.''')

if st.button("📊 Go to Statistics"):
    st.switch_page("../1_📊_Statistics.py")


