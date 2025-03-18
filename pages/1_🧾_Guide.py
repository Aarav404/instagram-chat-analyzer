st.set_page_config(page_title="Guide", page_icon="🧾", layout="wide")

st.logo("logo.png")

st.set_page_config(page_title="Page Title", layout="wide")

st.write('# 📥 Retrieve your files from instagram\n---')
st.write('''### 1. Open link\n- Open [instagram's download page↗](https://accountscenter.instagram.com/info_and_permissions/) and log in.
\n- Then click Request a download''')
st.image('https://app.doubletext.me/onboarding/messenger/0-messenger.png', width=450)
st.divider()

st.write('''# 2. Select information\n
- Select types of information.\n- This will allow us to choose which type of data we want to export.''')
st.image('https://app.doubletext.me/onboarding/messenger/2-messenger.png', width=450)
st.divider()

st.write('### 3. Select Messages\n- Select Messages and click Next.\n- Then select Download to device.')
st.image('https://app.doubletext.me/onboarding/messenger/3-messenger.png', width=450)
st.divider()

st.write('### 4. Select file options\n - Select the following file options')
col1, col2, col3 = st.columns(3, border=True)
with col1:
    st.write('Date range | **All time**')
with col2:
    st.write('Format | **JSON**')
with col3:
    st.write('Media Quality | **Low**')
st.write('- Make sure you hit **Save** for each setting.\n'
         '- You can optionally select a shorter date range for a faster download.')
st.image('https://app.doubletext.me/onboarding/messenger/4-messenger.png', width=450)

st.write('''# 5. Download all files\n- Now it's off to instagram to create your file. You'll get an email when it's ready -
 this might take up to a day.
- When you receive an email, click the link to [Instagram's download page](https://accountscenter.instagram.com/info_and_permissions/) and click **Download** for all files.''')

st.image('https://app.doubletext.me/onboarding/messenger/5-messenger.png', width=450)

st.write('# 6. Finding the files of the conversation\n- Unzip the zipped folder'
         '\n- Now go inside the folder -> your_instagram_activity -> messages -> inbox\n- Here find the conversation you want to analyze')
if st.button("📊 Statistics"):
    st.switch_page("2_📊_Statistics.py")
st.write(
    '\n- Open the folder of that conversation and upload the **message_1.json** file and or the other message files in the Statistics page.')
