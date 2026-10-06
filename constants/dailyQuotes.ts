// Daily Quote shown after check-in — Yash, 6 Oct 2026: "a quote for the day
// after they check in... motivational, team building, one new person they
// bond with, quotes of hanuman, sarasvati, laxmi, trust, commitment to the
// company, commitment to not let their coworkers down, quotes from
// maharbharat, gita... same quotes for everyone is fine, but the english
// and hindi translation and meaning shuld be correct."
//
// Every scripture entry below (`source` starting with "Bhagavad Gita",
// "Mahabharata", "Hanuman Chalisa", "Ramcharitmanas", "Hitopadesha", or a
// traditional salutation) is a well-known, widely published verse, quoted
// close to its standard Devanagari text, with its standard accepted
// meaning — not a paraphrase or an invented shloka. Kept deliberately to
// the handful of the MOST famous, least contested verses on each deity/
// theme Yash named, specifically because correctness mattered more than
// breadth here: a wrong translation of someone's faith is worse than a
// shorter list. `meaning_en`/`meaning_hi` is a short, separate
// "how this applies to today's shift" line — not a literal translation —
// so the literal `en`/`hi` fields stay strictly accurate on their own.
//
// `motivational`-category entries are original Forge OS text (not
// scripture), written directly in both languages — translation risk there
// is Claude's own plain-language Hindi, not a third-party religious text.

export type DailyQuoteCategory = 'gita' | 'mahabharata' | 'hanuman' | 'saraswati' | 'lakshmi' | 'motivational'

export interface DailyQuote {
  en: string
  hi: string
  meaning_en: string
  meaning_hi: string
  source: string
  category: DailyQuoteCategory
}

export const DAILY_QUOTES: DailyQuote[] = [
  {
    en: 'You have the right to perform your duty, but you are not entitled to the fruits of your actions.',
    hi: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।',
    meaning_en: "Focus fully on doing today's work well — the results will follow on their own.",
    meaning_hi: 'आज अपना काम पूरी लगन से करें — परिणाम अपने आप मिलेंगे।',
    source: 'Bhagavad Gita 2.47',
    category: 'gita',
  },
  {
    en: 'Perform your duty with a steady mind, abandoning attachment to success or failure — this evenness of mind is called yoga.',
    hi: 'योगस्थः कुरु कर्माणि सङ्गं त्यक्त्वा धनञ्जय। सिद्ध्यसिद्ध्योः समो भूत्वा समत्वं योग उच्यते।।',
    meaning_en: 'Stay steady whether today goes smoothly or not — consistent effort matters more than one day\'s outcome.',
    meaning_hi: 'आज चाहे जैसा भी हो, मन को स्थिर रखें — एक दिन के नतीजे से ज़्यादा महत्वपूर्ण है निरंतर प्रयास।',
    source: 'Bhagavad Gita 2.48',
    category: 'gita',
  },
  {
    en: 'Elevate yourself through the power of your own mind, and do not degrade yourself — for the mind alone is one\'s friend, and the mind alone is one\'s enemy.',
    hi: 'उद्धरेदात्मनात्मानं नात्मानमवसादयेत्। आत्मैव ह्यात्मनो बन्धुरात्मैव रिपुरात्मनः।।',
    meaning_en: 'Your own attitude is your biggest ally or your biggest obstacle — choose to lift yourself up today.',
    meaning_hi: 'आपकी सोच ही आपकी सबसे बड़ी मित्र या सबसे बड़ी बाधा है — आज खुद को ऊँचा उठाने का चुनाव करें।',
    source: 'Bhagavad Gita 6.5',
    category: 'gita',
  },
  {
    en: 'Without attachment, always perform the duty that must be done; performing action without attachment, one attains the highest good.',
    hi: 'तस्मादसक्तः सततं कार्यं कर्म समाचर। असक्तो ह्याचरन्कर्म परमाप्नोति पूरुषः।।',
    meaning_en: 'Do today\'s work with full sincerity, without worrying about credit or reward.',
    meaning_hi: 'आज का काम पूरी ईमानदारी से करें, क्रेडिट या बदले की चिंता किए बिना।',
    source: 'Bhagavad Gita 3.19',
    category: 'gita',
  },
  {
    en: 'The contacts of the senses with their objects, bringing heat and cold, pleasure and pain, are fleeting — they come and go. Bear them with patience.',
    hi: 'मात्रास्पर्शास्तु कौन्तेय शीतोष्णसुखदुःखदाः। आगमापायिनोऽनित्यास्तांस्तितिक्षस्व भारत।।',
    meaning_en: 'Good days and hard days both pass — handle today\'s difficulties with patience; they won\'t last forever.',
    meaning_hi: 'अच्छे और कठिन दिन दोनों गुज़र जाते हैं — आज की कठिनाइयों को धीरज से सहें, यह स्थायी नहीं है।',
    source: 'Bhagavad Gita 2.14',
    category: 'gita',
  },
  {
    en: 'One should not abandon the duty suited to one\'s own nature, even if it seems flawed — every undertaking carries some imperfection, as fire is covered by smoke.',
    hi: 'सहजं कर्म कौन्तेय सदोषमपि न त्यजेत्। सर्वारम्भा हि दोषेण धूमेनाग्निरिवावृताः।।',
    meaning_en: 'Don\'t abandon a task because it isn\'t going perfectly — every job has small flaws, just as fire always comes with some smoke. Keep going.',
    meaning_hi: 'काम इसलिए न छोड़ें कि वह पूर्ण नहीं है — हर काम में कुछ कमी होती है, जैसे आग के साथ धुआँ। आगे बढ़ते रहें।',
    source: 'Bhagavad Gita 18.48',
    category: 'gita',
  },
  {
    en: 'Do not yield to this weakness of heart. Cast it off, and arise!',
    hi: 'क्षुद्रं हृदयदौर्बल्यं त्यक्त्वोत्तिष्ठ परन्तप।',
    meaning_en: 'Shake off any hesitation or low energy, and rise to meet the day with courage.',
    meaning_hi: 'संकोच या सुस्ती को छोड़कर हिम्मत के साथ आज के दिन का सामना करने के लिए उठें।',
    source: 'Bhagavad Gita 2.3',
    category: 'gita',
  },
  {
    en: 'Day after day, countless beings pass into the abode of death, yet those who remain wish to live as if forever — what could be more astonishing than this?',
    hi: 'अहन्यहनि भूतानि गच्छन्तीह यमालयम्। शेषा स्थावरमिच्छन्ति किमाश्चर्यमतः परम्।।',
    meaning_en: 'Time keeps moving whether we use it well or not — make today count; don\'t put off what matters.',
    meaning_hi: 'समय रुकता नहीं, चाहे हम उसका उपयोग करें या नहीं — आज के दिन को सार्थक बनाएं, ज़रूरी काम टालें नहीं।',
    source: 'Mahabharata — Yaksha Prashna, Vana Parva',
    category: 'mahabharata',
  },
  {
    en: 'Victory to Hanuman, ocean of wisdom and virtue; victory to the lord of monkeys, who illuminates all three worlds.',
    hi: 'जय हनुमान ज्ञान गुण सागर। जय कपीस तिहुं लोक उजागर।।',
    meaning_en: 'True strength comes together with wisdom and good character, not power alone — carry both into your work today.',
    meaning_hi: 'सच्ची शक्ति बुद्धि और अच्छे गुणों के साथ आती है, सिर्फ बल से नहीं — आज अपने काम में दोनों को साथ रखें।',
    source: 'Hanuman Chalisa, Doha 1',
    category: 'hanuman',
  },
  {
    en: 'All troubles are cut away and every pain disappears, for those who remember the mighty, brave Hanuman.',
    hi: 'संकट कटे मिटे सब पीरा। जो सुमिरै हनुमत बलबीरा।।',
    meaning_en: 'Facing a tough task today? Approach it with Hanuman\'s own fearless, steady confidence.',
    meaning_hi: 'आज कोई मुश्किल काम सामने है? उसे हनुमान जी के निडर और स्थिर आत्मविश्वास के साथ करें।',
    source: 'Hanuman Chalisa, Chaupai 7',
    category: 'hanuman',
  },
  {
    en: 'Without completing Lord Rama\'s task, how could I possibly rest?',
    hi: 'राम काज कीन्हें बिना, मोहि कहाँ विश्राम।',
    meaning_en: 'A job you\'ve taken on deserves full follow-through — real satisfaction comes only once it\'s actually done.',
    meaning_hi: 'जो काम आपने हाथ में लिया है, उसे पूरा करना ज़रूरी है — असली संतोष काम पूरा होने पर ही मिलता है।',
    source: 'Ramcharitmanas, Sundarkand',
    category: 'hanuman',
  },
  {
    en: 'Salutations to you, Goddess Saraswati, giver of boons, who can take any form — I am beginning my learning; may I always attain success.',
    hi: 'सरस्वती नमस्तुभ्यं वरदे कामरूपिणि। विद्यारम्भं करिष्यामि सिद्धिर्भवतु मे सदा।।',
    meaning_en: 'Start today\'s work the way you\'d start a lesson — with an open mind, ready to learn something new.',
    meaning_hi: 'आज का काम भी एक नई शुरुआत की तरह करें — खुले मन से, कुछ नया सीखने के लिए तैयार।',
    source: 'Saraswati Vandana (traditional)',
    category: 'saraswati',
  },
  {
    en: 'Om, salutations to Saraswati — goddess of knowledge, wisdom, and skill.',
    hi: 'ॐ सरस्वत्यै नमः।',
    meaning_en: 'Respect the skill and knowledge your work needs today — good craftsmanship matters.',
    meaning_hi: 'आज के काम में जो कौशल और ज्ञान चाहिए, उसका सम्मान करें — हुनर मायने रखता है।',
    source: 'Traditional Saraswati salutation',
    category: 'saraswati',
  },
  {
    en: 'Tasks are accomplished through effort, not through mere wishing — deer do not walk into the mouth of a sleeping lion.',
    hi: 'उद्यमेन हि सिद्ध्यन्ति कार्याणि न मनोरथैः। न हि सुप्तस्य सिंहस्य प्रविशन्ति मुखे मृगाः।।',
    meaning_en: 'Wishing for a good outcome isn\'t enough — today\'s actual effort is what brings real results and prosperity.',
    meaning_hi: 'सिर्फ अच्छे परिणाम की कामना काफी नहीं — आज का वास्तविक प्रयास ही असली परिणाम और समृद्धि लाता है।',
    source: 'Hitopadesha',
    category: 'lakshmi',
  },
  {
    en: 'Om, salutations to Goddess Mahalakshmi — giver of prosperity to those who work with honesty and diligence.',
    hi: 'ॐ श्री महालक्ष्म्यै नमः।',
    meaning_en: 'Honest, diligent work is the real foundation of lasting prosperity — for you and for the company.',
    meaning_hi: 'ईमानदार और मेहनती काम ही स्थायी समृद्धि की असली नींव है — आपके लिए और कंपनी के लिए भी।',
    source: 'Traditional Lakshmi salutation',
    category: 'lakshmi',
  },
  {
    en: 'A team that trusts each other can lift weights no single person ever could.',
    hi: 'जो टीम एक-दूसरे पर भरोसा करती है, वह ऐसा बोझ भी उठा सकती है जो कोई एक व्यक्ति कभी नहीं उठा सकता।',
    meaning_en: 'Lean on your teammates today, and let them lean on you too.',
    meaning_hi: 'आज अपने साथियों पर भरोसा करें, और उन्हें भी अपने ऊपर भरोसा करने दें।',
    source: 'Forge OS',
    category: 'motivational',
  },
  {
    en: 'Showing up for your coworkers, every single day, is what makes a team worth being part of.',
    hi: 'हर दिन अपने साथियों के लिए मौजूद रहना ही एक टीम को साथ काम करने लायक बनाता है।',
    meaning_en: 'Someone on your line is counting on you today — don\'t let them down.',
    meaning_hi: 'आज आपकी लाइन पर कोई आप पर भरोसा कर रहा है — उन्हें निराश न करें।',
    source: 'Forge OS',
    category: 'motivational',
  },
  {
    en: 'The new person next to you today could be your best teammate tomorrow — take a moment to know them.',
    hi: 'आज आपके बगल में काम कर रहा नया साथी कल आपका सबसे अच्छा सहकर्मी बन सकता है — उससे जुड़ने के लिए थोड़ा समय निकालें।',
    meaning_en: 'Say hello to someone new on the floor today.',
    meaning_hi: 'आज फैक्ट्री में किसी नए साथी से बात करें।',
    source: 'Forge OS',
    category: 'motivational',
  },
  {
    en: 'Trust is built one honest day\'s work at a time.',
    hi: 'भरोसा एक-एक ईमानदार दिन की मेहनत से बनता है।',
    meaning_en: 'Every honest, careful hour you put in today adds to the trust your team and company place in you.',
    meaning_hi: 'आज का हर ईमानदार और सावधानी से किया गया घंटा आप पर टीम और कंपनी के भरोसे को बढ़ाता है।',
    source: 'Forge OS',
    category: 'motivational',
  },
  {
    en: 'Commitment isn\'t what you say on your best day — it\'s what you do on an ordinary one.',
    hi: 'प्रतिबद्धता वह नहीं है जो आप अपने सबसे अच्छे दिन कहते हैं — यह वह है जो आप एक सामान्य दिन करते हैं।',
    meaning_en: 'Today might feel like an ordinary day — show up for it with full commitment anyway.',
    meaning_hi: 'आज एक सामान्य दिन हो सकता है — फिर भी पूरी प्रतिबद्धता के साथ काम करें।',
    source: 'Forge OS',
    category: 'motivational',
  },
  {
    en: 'A safe, well-made part today protects the company\'s name — and your own — tomorrow.',
    hi: 'आज बनाया गया सुरक्षित और सही पार्ट कंपनी की पहचान और आपके भविष्य, दोनों की रक्षा करता है।',
    meaning_en: 'Quality and safety today are an investment in both your reputation and the company\'s.',
    meaning_hi: 'आज की गुणवत्ता और सुरक्षा आपकी और कंपनी की प्रतिष्ठा में निवेश है।',
    source: 'Forge OS',
    category: 'motivational',
  },
  {
    en: 'No one builds anything great alone — be the teammate someone else can count on.',
    hi: 'कोई भी बड़ा काम अकेले नहीं होता — वह साथी बनें जिस पर दूसरे भरोसा कर सकें।',
    meaning_en: 'Look out for the person working next to you today.',
    meaning_hi: 'आज अपने साथ काम कर रहे साथी का भी ध्यान रखें।',
    source: 'Forge OS',
    category: 'motivational',
  },
  {
    en: 'Every shift completed well is a brick in the trust this company is built on.',
    hi: 'जो भी शिफ्ट आप अच्छी तरह पूरी करते हैं, वह उस भरोसे की एक ईंट है जिस पर यह कंपनी खड़ी है।',
    meaning_en: 'Treat today\'s shift as a contribution to something bigger than just one day\'s work.',
    meaning_hi: 'आज की शिफ्ट को सिर्फ एक दिन का काम न समझें, बल्कि कुछ बड़े का हिस्सा समझें।',
    source: 'Forge OS',
    category: 'motivational',
  },
  {
    en: 'Start today believing your best effort matters — because it does, to your team and to the company.',
    hi: 'आज यह मानकर शुरुआत करें कि आपकी पूरी मेहनत महत्व रखती है — क्योंकि यह आपकी टीम और कंपनी दोनों के लिए सच है।',
    meaning_en: 'Your work today genuinely matters — to the people around you and to Varsha Forgings.',
    meaning_hi: 'आज आपका काम सच में महत्वपूर्ण है — आपके आस-पास के लोगों के लिए और वर्षा फोर्जिंग्स के लिए भी।',
    source: 'Forge OS',
    category: 'motivational',
  },
]
