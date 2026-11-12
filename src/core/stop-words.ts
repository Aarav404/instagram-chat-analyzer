/** Exclude grammatical filler from frequency rankings, not message search or word totals. */
export const STOP_WORDS = new Set(`
a an the and or but if then than because as at by for from in into of on onto out over
to up with without about through between during before after under again further
am is are was were be been being do does did doing have has had having
i me my mine myself we us our ours ourselves you your yours yourself yourselves
he him his himself she her hers herself it its itself they them their theirs themselves
this that these those there here what which who whom whose when where why how
all any both each few more most other some such no nor not only own same so too very
can could will would shall should may might must just also even still already really
im i'm ive i've ill i'll id i'd youre you're youve you've youll you'll youd you'd
hes he's shes she's its it's theyre they're weve we've were we're thats that's
theres there's whats what's isnt isn't arent aren't wasnt wasn't werent weren't
dont don't doesnt doesn't didnt didn't cant can't couldnt couldn't wont won't
wouldnt wouldn't shouldnt shouldn't hasnt hasn't havent haven't hadnt hadn't
yes yep yup yeah ya nah nope ok okay oh ah uh um hmm hm hey hi hello bye
now well much many one get got getting go going went come came say said says
tell told see seen know knew think thought want wanted need let lets let's
like kinda sort sorta cuz coz cos cause abt btw tho though js pls plz ur u r
hai hain h hi he ho hu hun hoon hn ha haa haan han nahi nahin nhi nai ni na
tha thi the thaa thhi honge hoga hogi hota hoti hotey toh to bhi ab abb abhi
aur or ke ki ka ko se mein main mai mei me pe par pr per liye lie bas bs
kya kyu kyun kyuki kyunki kab kaha kahan kaise aise ese aisa esa aisi esi
ye yeh yehi wo woh vo wahi waha wahan yaha yahan jo joh jab tab tb jabki
tu tum tumhe tumko tumhara tumhari tumhare tera teri tere tujhe tujhko
aap ap apko aapko aapka aapki aapke mujhe muje mjhe mera meri mere mujhko
hum ham hume hame humko hamara hamari hamare uska uski uske usko usse use
iska iski iske isko isse inka inki inke unka unki unke unko unhe kuch kch
koi koyi kisse kis kisne kiski kiska kitna kitni itna itni utna utni
kar kr karo kro kara kra kari kri karna krna karne krne raha rha rahi rhi
rahe rhe rha rhi rhae diya dia diye hua huya hui huyi hue huye hona hone
bhai bro yaar yar arey arre are achha acha accha acchaa achaa matlab mtlb
`.trim().split(/\s+/))
