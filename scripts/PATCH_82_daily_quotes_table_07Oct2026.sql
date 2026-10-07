-- PATCH_82_daily_quotes_table_07Oct2026.sql
--
-- Yash, 7 Oct 2026, on the just-shipped Quote of the Day banner:
-- "yes you should have it in a table so new ones can be added easily,
-- but a 90 day build would not make it reperative, but quotes should be
-- motivating, touching, reminding them of goodness, of their bread giver
-- (the company) should be meaningful. and you confirm everyone sees this
-- incluiding me."
--
-- Moves the quote set from constants/dailyQuotes.ts (static, bundled into
-- the APK, needed a full rebuild+reinstall for every new quote) into this
-- table, so Claude can add/edit quotes any time via SQL with no app
-- rebuild and no reinstall needed -- every device picks up new rows on
-- its next fetch. Widened from 24 to 90 rows so the rotation (still one
-- quote per real IST calendar day, same for everyone) doesn't visibly
-- repeat inside a normal month. The pick-today's-quote logic itself moves
-- into get_quote_of_the_day() below, so it automatically keeps working
-- and automatically gets less repetitive as more rows are added later --
-- nothing in the app needs to change again just to grow the set.
--
-- New theme per this message, not in the original 24: direct gratitude
-- toward "the company as bread-giver" -- the livelihood/family-provider
-- angle, distinct from (and now alongside) the original
-- trust/commitment/new-teammate/general-motivation themes and the 15
-- scripture quotes already shipped (kept verbatim, still the standard,
-- widely published text/translation for each -- see the accuracy note in
-- the original commit/CLAUDE.md entry; correctness there matters more
-- than breadth, so scripture grew by only 5 more of the most famous,
-- least-contested Gita verses, not by stretching into obscure ones).
--
-- Confirms "everyone sees this including me": QuoteOfTheDay is rendered
-- in CheckInCard.tsx (owner/plant-head/hr-admin/manager/supervisor/
-- security dashboards all share this one component) and in
-- app/(worker)/home.tsx (member role) -- unchanged by this patch, only
-- the data source moves from the static array to this table + RPC.

create table if not exists public.daily_quotes (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null unique,
  en text not null,
  hi text not null,
  meaning_en text not null,
  meaning_hi text not null,
  source text not null,
  category text not null check (category in ('gita','mahabharata','hanuman','saraswati','lakshmi','motivational')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.daily_quotes enable row level security;

-- Same shape as shifts_select/shifts_write -- every signed-in employee of
-- any role can read (this is shown to everyone), writes are management
-- RPC/dashboard-only (the app itself has no add/edit screen for this; new
-- rows come from Claude via SQL, same as every other data-registry table
-- in this project).
drop policy if exists daily_quotes_select on public.daily_quotes;
create policy daily_quotes_select on public.daily_quotes
  for select using (auth.uid() is not null);

drop policy if exists daily_quotes_write on public.daily_quotes;
create policy daily_quotes_write on public.daily_quotes
  for all using (is_management());

-- Picks today's quote: deterministic, same for every employee on a given
-- real IST calendar day, and automatically spans however many rows are
-- active right now -- no app-side change needed when more are added
-- later. `now() at time zone 'Asia/Kolkata'` is this project's own locked
-- raw-SQL IST pattern (see CLAUDE.md); dividing its epoch by 86400 counts
-- whole IST days, so the result changes exactly once per IST day, never
-- from a server/device's own local clock.
create or replace function public.get_quote_of_the_day()
returns table (
  en text,
  hi text,
  meaning_en text,
  meaning_hi text,
  source text,
  category text
)
language sql
stable
as $$
  with active as (
    select q.en, q.hi, q.meaning_en, q.meaning_hi, q.source, q.category,
           row_number() over (order by q.sort_order) - 1 as rn,
           count(*) over () as total
    from public.daily_quotes q
    where q.is_active = true
  )
  select active.en, active.hi, active.meaning_en, active.meaning_hi, active.source, active.category
  from active
  where active.total > 0
    and active.rn = (
      floor(extract(epoch from (now() at time zone 'Asia/Kolkata')) / 86400)::bigint % active.total
    );
$$;

grant execute on function public.get_quote_of_the_day() to authenticated;

-- ---------------------------------------------------------------------------
-- SEED -- 90 rows. 20 scripture (15 carried over from the original 24,
-- kept verbatim/unchanged, + 5 more of the most famous Gita verses), 70
-- original Forge-OS-written secular ones across gratitude-to-the-company,
-- team trust, commitment, new-teammate bonding, and general motivation --
-- interleaved so scripture and secular both recur every few days rather
-- than clustering.
-- ---------------------------------------------------------------------------

insert into public.daily_quotes (sort_order, en, hi, meaning_en, meaning_hi, source, category) values

-- Block 1: gratitude A1-A4 + Gita 2.47
(1, 'The roof over your family and the food on their plate both trace back to the work you do here today.', 'आपके परिवार के सिर पर छत और थाली में खाना, दोनों की जड़ आज आपके यहाँ किए गए काम में है।', 'Let that connection sit with you for a moment before you start today''s shift.', 'आज की शिफ्ट शुरू करने से पहले इस जुड़ाव को एक पल के लिए महसूस करें।', 'Forge OS', 'motivational'),
(2, 'A company isn''t a building — it is the shared effort of everyone who shows up for it, including you.', 'कोई कंपनी सिर्फ एक इमारत नहीं होती — वह उन सभी के साझा प्रयास से बनती है जो उसके लिए आते हैं, आप भी उनमें से एक हैं।', 'Your presence today is part of what keeps this company standing.', 'आज आपकी मौजूदगी इस कंपनी को खड़ा रखने का एक हिस्सा है।', 'Forge OS', 'motivational'),
(3, 'Every salary slip is really a record of trust kept, shift after shift.', 'हर सैलरी स्लिप असल में शिफ्ट-दर-शिफ्ट निभाए गए भरोसे का रिकॉर्ड है।', 'Today''s shift is one more entry in that record — make it a good one.', 'आज की शिफ्ट भी उस रिकॉर्ड में एक और प्रविष्टि है — इसे अच्छा बनाएं।', 'Forge OS', 'motivational'),
(4, 'The company that pays you is also the company waiting on your skill — give it your best.', 'जो कंपनी आपको वेतन देती है, वह आपके हुनर पर भी भरोसा करती है — उसे अपना सर्वश्रेष्ठ दें।', 'Skill and gratitude aren''t separate things at work — they show up together.', 'काम में हुनर और कृतज्ञता अलग-अलग नहीं होते — वे साथ-साथ दिखते हैं।', 'Forge OS', 'motivational'),
(5, 'You have the right to perform your duty, but you are not entitled to the fruits of your actions.', 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।', 'Focus fully on doing today''s work well — the results will follow on their own.', 'आज अपना काम पूरी लगन से करें — परिणाम अपने आप मिलेंगे।', 'Bhagavad Gita 2.47', 'gita'),

-- Block 2: gratitude A5-A7 + Gita 2.48
(6, 'Before you were hired, this company was already providing for hundreds of families. Today, yours is one of them.', 'आपके आने से पहले भी यह कंपनी सैकड़ों परिवारों का सहारा थी। आज आपका परिवार भी उनमें से एक है।', 'Being part of something that provides for many families is worth real care, not just routine.', 'कई परिवारों का सहारा बनने वाली इस जगह का हिस्सा होना सिर्फ रूटीन नहीं, सच्ची देखभाल के काबिल है।', 'Forge OS', 'motivational'),
(7, 'Loyalty isn''t owed to a building — it''s earned, every day, by the people a company feeds and the people who keep it running.', 'वफ़ादारी किसी इमारत के लिए नहीं होती — वह हर दिन उन लोगों से कमाई जाती है जिनका यह कंपनी पालन करती है और जो इसे चलाते हैं।', 'That loyalty runs both ways today — the company keeps its promise, you keep yours.', 'आज यह वफ़ादारी दोनों तरफ से है — कंपनी अपना वादा निभाती है, आप अपना निभाएं।', 'Forge OS', 'motivational'),
(8, 'The machine you operate today keeps running because the company keeps its promise to you — keep yours to it.', 'आज जो मशीन आप चलाते हैं, वह इसलिए चलती है क्योंकि कंपनी ने आपसे किया वादा निभाया है — आप भी अपना वादा निभाएं।', 'A fair exchange deserves a fair effort in return.', 'एक उचित लेन-देन के बदले उचित प्रयास ज़रूरी है।', 'Forge OS', 'motivational'),
(9, 'Perform your duty with a steady mind, abandoning attachment to success or failure — this evenness of mind is called yoga.', 'योगस्थः कुरु कर्माणि सङ्गं त्यक्त्वा धनञ्जय। सिद्ध्यसिद्ध्योः समो भूत्वा समत्वं योग उच्यते।।', 'Stay steady whether today goes smoothly or not — consistent effort matters more than one day''s outcome.', 'आज चाहे जैसा भी हो, मन को स्थिर रखें — एक दिन के नतीजे से ज़्यादा महत्वपूर्ण है निरंतर प्रयास।', 'Bhagavad Gita 2.48', 'gita'),

-- Block 3: gratitude A8-A11 + Gita 6.5
(10, 'A paycheck is proof someone trusted you enough to count on your work this month.', 'सैलरी इस बात का सबूत है कि किसी ने इस महीने आपके काम पर भरोसा किया है।', 'Live up to that trust with how you work today, not just when it''s convenient.', 'इस भरोसे को आज अपने काम के ज़रिए सही साबित करें, सिर्फ तब नहीं जब सुविधाजनक हो।', 'Forge OS', 'motivational'),
(11, 'Gratitude for a livelihood shows up best in how carefully you do the work that earns it.', 'अपनी रोज़ी-रोटी के लिए कृतज्ञता सबसे अच्छे ढंग से तब दिखती है जब आप उसे कमाने वाला काम ध्यान से करते हैं।', 'Care in your work today is a quiet, real way of saying thank you.', 'आज के काम में सावधानी ही आपका असली "धन्यवाद" कहने का तरीका है।', 'Forge OS', 'motivational'),
(12, 'This company has fed your family for however long you''ve worked here — that is worth showing up fully for, today.', 'जितने समय से आप यहाँ काम कर रहे हैं, इस कंपनी ने उतने समय तक आपके परिवार का पेट भरा है — आज पूरी तरह उपस्थित रहने लायक है यह बात।', 'Full presence, not just physical attendance, is what today deserves.', 'आज सिर्फ मौजूद रहना नहीं, पूरी तरह उपस्थित रहना ज़रूरी है।', 'Forge OS', 'motivational'),
(13, 'An honest day''s work in return for an honest day''s wage is a fair exchange, and a good one.', 'ईमानदार वेतन के बदले ईमानदार काम — यह एक उचित और अच्छा लेन-देन है।', 'Neither side of that exchange should feel like a favor — it''s simply fair.', 'इस लेन-देन का कोई भी पक्ष किसी पर एहसान जैसा नहीं लगना चाहिए — यह बस उचित है।', 'Forge OS', 'motivational'),
(14, 'Elevate yourself through the power of your own mind, and do not degrade yourself — for the mind alone is one''s friend, and the mind alone is one''s enemy.', 'उद्धरेदात्मनात्मानं नात्मानमवसादयेत्। आत्मैव ह्यात्मनो बन्धुरात्मैव रिपुरात्मनः।।', 'Your own attitude is your biggest ally or your biggest obstacle — choose to lift yourself up today.', 'आपकी सोच ही आपकी सबसे बड़ी मित्र या सबसे बड़ी बाधा है — आज खुद को ऊँचा उठाने का चुनाव करें।', 'Bhagavad Gita 6.5', 'gita'),

-- Block 4: gratitude A12-A14 + Gita 6.6 (new)
(15, 'The quality you put into your work today becomes the reputation that keeps this company — and your job — standing tomorrow.', 'आज आप अपने काम में जो गुणवत्ता डालते हैं, वही प्रतिष्ठा कल इस कंपनी और आपकी नौकरी को खड़ा रखती है।', 'Today''s careful work is tomorrow''s job security, for you and everyone around you.', 'आज का सावधानी से किया काम कल की नौकरी की सुरक्षा है — आपकी और सबकी।', 'Forge OS', 'motivational'),
(16, 'Think of today''s shift as paying forward what this company has already given your family.', 'आज की शिफ्ट को इस रूप में देखें कि आप उस चीज़ को आगे बढ़ा रहे हैं जो यह कंपनी आपके परिवार को पहले ही दे चुकी है।', 'A day''s work as a small repayment, not just a routine task.', 'आज का काम एक छोटी वापसी के रूप में देखें, सिर्फ एक रूटीन काम नहीं।', 'Forge OS', 'motivational'),
(17, 'A business survives on the same thing a family does — people showing up for each other, day after day.', 'एक व्यवसाय भी उसी चीज़ पर टिका रहता है जिस पर एक परिवार टिका रहता है — लोगों का रोज़ एक-दूसरे के लिए मौजूद रहना।', 'Show up for your coworkers today the way you''d show up for family.', 'आज अपने साथियों के लिए वैसे ही मौजूद रहें जैसे परिवार के लिए रहते हैं।', 'Forge OS', 'motivational'),
(18, 'For him who has conquered his mind, his mind is the best of friends; but for one who has failed to do so, his mind will remain the greatest enemy.', 'बन्धुरात्मात्मनस्तस्य येनात्मैवात्मना जितः। अनात्मनस्तु शत्रुत्वे वर्तेतात्मैव शत्रुवत्।।', 'A disciplined mind is your best coworker; an undisciplined one works against you — choose which one runs your shift today.', 'अनुशासित मन आपका सबसे अच्छा साथी है; अनियंत्रित मन आपके ही विरुद्ध काम करता है — आज तय करें कि आज की शिफ्ट किसके हाथ में है।', 'Bhagavad Gita 6.6', 'gita'),

-- Block 5: gratitude A15-A18 + Gita 3.19
(19, 'What you build today isn''t just a part — it''s one more reason this company can keep paying everyone tomorrow.', 'आज आप जो बनाते हैं वह सिर्फ एक पार्ट नहीं है — यह उस वजह का एक हिस्सा है जिससे यह कंपनी कल भी सबको वेतन दे सके।', 'Every part made right is a small contribution to everyone else''s livelihood too, not just your own.', 'सही बनाया हुआ हर पार्ट सिर्फ आपकी नहीं, बल्कि सबकी रोज़ी-रोटी में एक छोटा योगदान है।', 'Forge OS', 'motivational'),
(20, 'Respecting the work means respecting what it provides — for you, and for every other family depending on this company.', 'काम का सम्मान करने का मतलब है उस चीज़ का सम्मान करना जो वह देता है — आपके लिए, और इस कंपनी पर निर्भर हर परिवार के लिए।', 'Carelessness at work doesn''t just affect you — it affects everyone this company supports.', 'काम में लापरवाही सिर्फ आपको नहीं, इस कंपनी के सहारे चल रहे हर परिवार को प्रभावित करती है।', 'Forge OS', 'motivational'),
(21, 'The company doesn''t run itself — it runs because people like you choose, every morning, to show up for it.', 'कंपनी खुद से नहीं चलती — यह चलती है क्योंकि आप जैसे लोग हर सुबह इसके लिए आने का फ़ैसला करते हैं।', 'That choice, made again today, is worth something real.', 'आज फिर से किया गया यह फ़ैसला सच में मूल्यवान है।', 'Forge OS', 'motivational'),
(22, 'A steady job is a quiet kind of blessing — treat today''s work as worthy of that.', 'एक स्थिर नौकरी एक शांत सी नियामत है — आज के काम को उसी सम्मान के साथ करें।', 'Don''t let the ordinariness of a steady job make you take it for granted today.', 'एक स्थिर नौकरी की सामान्यता को आज हल्के में न लें।', 'Forge OS', 'motivational'),
(23, 'Without attachment, always perform the duty that must be done; performing action without attachment, one attains the highest good.', 'तस्मादसक्तः सततं कार्यं कर्म समाचर। असक्तो ह्याचरन्कर्म परमाप्नोति पूरुषः।।', 'Do today''s work with full sincerity, without worrying about credit or reward.', 'आज का काम पूरी ईमानदारी से करें, क्रेडिट या बदले की चिंता किए बिना।', 'Bhagavad Gita 3.19', 'gita'),

-- Block 6: gratitude A19-A20, trust B1 + Gita 2.14
(24, 'The best thanks you can give an employer is good, honest work — no speech required.', 'किसी नियोक्ता को दिया जा सकने वाला सबसे अच्छा धन्यवाद अच्छा, ईमानदार काम है — किसी भाषण की ज़रूरत नहीं।', 'Say thank you today with your hands, not your words.', 'आज धन्यवाद अपने हाथों से कहें, शब्दों से नहीं।', 'Forge OS', 'motivational'),
(25, 'Every honest day you work here is a small debt repaid to the place that keeps your family going.', 'यहाँ आज का हर ईमानदार दिन उस जगह का एक छोटा सा कर्ज़ चुकाना है जो आपके परिवार को चला रही है।', 'A small, steady repayment, made again today.', 'आज फिर से एक छोटी, स्थिर अदायगी।', 'Forge OS', 'motivational'),
(26, 'Trust is quiet — it is built in the ordinary moments no one is watching.', 'भरोसा शांत होता है — यह उन सामान्य पलों में बनता है जब कोई देख नहीं रहा होता।', 'Do the right thing today even when no one''s checking — that''s where real trust comes from.', 'आज सही काम करें, भले ही कोई देख न रहा हो — असली भरोसा यहीं से बनता है।', 'Forge OS', 'motivational'),
(27, 'The contacts of the senses with their objects, bringing heat and cold, pleasure and pain, are fleeting — they come and go. Bear them with patience.', 'मात्रास्पर्शास्तु कौन्तेय शीतोष्णसुखदुःखदाः। आगमापायिनोऽनित्यास्तांस्तितिक्षस्व भारत।।', 'Good days and hard days both pass — handle today''s difficulties with patience; they won''t last forever.', 'अच्छे और कठिन दिन दोनों गुज़र जाते हैं — आज की कठिनाइयों को धीरज से सहें, यह स्थायी नहीं है।', 'Bhagavad Gita 2.14', 'gita'),

-- Block 7: trust B2-B5 + Gita 2.70 (new)
(28, 'The strongest team isn''t the one with no problems — it''s the one that tells each other the truth about them.', 'सबसे मज़बूत टीम वह नहीं जिसमें कोई समस्या न हो — वह है जो एक-दूसरे को समस्याओं के बारे में सच बताती है।', 'If something''s wrong on your line today, say so — honestly, early.', 'आज अगर आपकी लाइन पर कुछ गड़बड़ है, तो उसे जल्दी और ईमानदारी से बताएं।', 'Forge OS', 'motivational'),
(29, 'You don''t have to like everyone on your shift to trust them with the work — trust is earned by reliability, not friendship.', 'अपनी शिफ्ट के हर साथी को पसंद करना ज़रूरी नहीं, काम पर भरोसा करने के लिए — भरोसा दोस्ती से नहीं, भरोसेमंदी से कमाया जाता है।', 'Be reliable today, whether or not you''re everyone''s friend.', 'आज भरोसेमंद बनें, चाहे आप सबके दोस्त हों या न हों।', 'Forge OS', 'motivational'),
(30, 'A workplace where people watch each other''s backs gets more done than one where everyone works alone.', 'जहाँ लोग एक-दूसरे का ध्यान रखते हैं, वहाँ अकेले काम करने वाली जगह से ज़्यादा काम होता है।', 'Look out for your teammate today, not just your own task.', 'आज सिर्फ अपना काम नहीं, अपने साथी का भी ध्यान रखें।', 'Forge OS', 'motivational'),
(31, 'Ask for help today if you need it — a team that asks and offers help is stronger than one that pretends not to need it.', 'आज ज़रूरत हो तो मदद मांगें — जो टीम मदद मांगती और देती है, वह उससे ज़्यादा मज़बूत है जो ज़रूरत न होने का दिखावा करती है।', 'Asking for help isn''t weakness — pretending you don''t need it, when you do, is riskier.', 'मदद मांगना कमजोरी नहीं है — ज़रूरत होने पर उसे छिपाना ज़्यादा जोखिम भरा है।', 'Forge OS', 'motivational'),
(32, 'As the ocean remains undisturbed by the incessant flow of rivers merging into it, likewise the one who is unmoved despite the flow of desires around them attains peace — not the one who chases every desire.', 'आपूर्यमाणमचलप्रतिष्ठं समुद्रमापः प्रविशन्ति यद्वत्। तद्वत्कामा यं प्रविशन्ति सर्वे स शान्तिमाप्नोति न कामकामी।।', 'Staying calm when demands pour in from every side is real strength — don''t let every small thing pull you off course today.', 'जब चारों तरफ से मांगें आएं, तब भी शांत रहना असली ताकत है — आज छोटी-छोटी बातों से विचलित न हों।', 'Bhagavad Gita 2.70', 'gita'),

-- Block 8: trust B6-B8 + Gita 18.48
(33, 'Trust grows when you do what you said you''d do, even when no one would notice if you didn''t.', 'भरोसा तब बढ़ता है जब आप वही करते हैं जो कहा था, भले ही न करने पर किसी को पता न चले।', 'Follow through on today''s small commitments, not just the big ones.', 'आज की छोटी प्रतिबद्धताओं को भी निभाएं, सिर्फ बड़ी वाली नहीं।', 'Forge OS', 'motivational'),
(34, 'The person next to you on the line is trusting you to do your part right — don''t make them carry what''s yours.', 'लाइन में आपके बगल वाला साथी भरोसा करता है कि आप अपना हिस्सा सही करेंगे — उन्हें अपना बोझ न उठाने दें।', 'Carry your own share fully today.', 'आज अपना पूरा हिस्सा खुद उठाएं।', 'Forge OS', 'motivational'),
(35, 'A small favor returned today is how real trust between coworkers actually gets built.', 'आज लौटाई गई एक छोटी मदद ही साथियों के बीच असली भरोसा बनाती है।', 'Return a favor today, even a small one.', 'आज एक छोटी सी मदद लौटाएं।', 'Forge OS', 'motivational'),
(36, 'One should not abandon the duty suited to one''s own nature, even if it seems flawed — every undertaking carries some imperfection, as fire is covered by smoke.', 'सहजं कर्म कौन्तेय सदोषमपि न त्यजेत्। सर्वारम्भा हि दोषेण धूमेनाग्निरिवावृताः।।', 'Don''t abandon a task because it isn''t going perfectly — every job has small flaws, just as fire always comes with some smoke. Keep going.', 'काम इसलिए न छोड़ें कि वह पूर्ण नहीं है — हर काम में कुछ कमी होती है, जैसे आग के साथ धुआँ। आगे बढ़ते रहें।', 'Bhagavad Gita 18.48', 'gita'),

-- Block 9: trust B9-B12 + Gita 2.3
(37, 'Trust once broken takes far longer to rebuild than it took to earn — guard it carefully today.', 'टूटा हुआ भरोसा बनाने में, कमाने से कहीं ज़्यादा समय लगता है — आज उसे सावधानी से बचाएं।', 'One careless moment today can undo a long record of trust — be mindful.', 'आज की एक लापरवाही लंबे समय के भरोसे को मिटा सकती है — सावधान रहें।', 'Forge OS', 'motivational'),
(38, 'The safest factory floor is the one where everyone trusts everyone else to follow the rules, not just themselves.', 'सबसे सुरक्षित फैक्ट्री फ्लोर वह है जहाँ सभी एक-दूसरे पर नियम मानने का भरोसा करते हैं, सिर्फ खुद पर नहीं।', 'Follow the safety rules today — someone else''s safety depends on it too.', 'आज सुरक्षा नियम मानें — इसमें किसी और की सुरक्षा भी शामिल है।', 'Forge OS', 'motivational'),
(39, 'Teach someone something today, even something small — that is how trust between experienced and new hands grows.', 'आज किसी को कुछ सिखाएं, भले ही छोटी बात हो — इससे अनुभवी और नए साथियों के बीच भरोसा बढ़ता है।', 'A small lesson shared today builds a bridge that lasts.', 'आज साझा किया गया एक छोटा सा सीख एक स्थायी पुल बनाता है।', 'Forge OS', 'motivational'),
(40, 'Do not yield to this weakness of heart. Cast it off, and arise!', 'क्षुद्रं हृदयदौर्बल्यं त्यक्त्वोत्तिष्ठ परन्तप।', 'Shake off any hesitation or low energy, and rise to meet the day with courage.', 'संकोच या सुस्ती को छोड़कर हिम्मत के साथ आज के दिन का सामना करने के लिए उठें।', 'Bhagavad Gita 2.3', 'gita'),

-- Block 10: trust B13-B15 + Gita 3.21 (new)
(41, 'Trust isn''t asking for blind faith — it''s earning the benefit of the doubt, one honest shift at a time.', 'भरोसा अंधविश्वास नहीं मांगता — यह हर ईमानदार शिफ्ट से धीरे-धीरे कमाया जाता है।', 'Today is one more shift that can earn — or spend — that benefit of the doubt.', 'आज की शिफ्ट भी उस भरोसे को कमा सकती है — या खो सकती है।', 'Forge OS', 'motivational'),
(42, 'When something goes wrong, own your part honestly — that is what keeps a team''s trust intact, not hiding it.', 'जब कुछ गलत हो, तो अपनी गलती ईमानदारी से मानें — इससे टीम का भरोसा बना रहता है, छिपाने से नहीं।', 'If you make a mistake today, say so plainly — it costs less trust than hiding it.', 'आज कोई गलती हो तो साफ़ बता दें — इसे छिपाने से ज़्यादा भरोसा खर्च होता है।', 'Forge OS', 'motivational'),
(43, 'The quietest form of respect at work is simply doing your job well enough that others don''t have to worry about it.', 'काम में सम्मान का सबसे शांत तरीका है अपना काम इतना अच्छा करना कि दूसरों को उसकी चिंता ही न करनी पड़े।', 'Do today''s work well enough that it''s one less thing for anyone else to worry about.', 'आज का काम इतना अच्छा करें कि वह किसी और की चिंता की सूची से हट जाए।', 'Forge OS', 'motivational'),
(44, 'Whatever action a great person performs, common people follow; and whatever standards they set, the world pursues.', 'यद्यदाचरति श्रेष्ठस्तत्तदेवेतरो जनः। स यत्प्रमाणं कुरुते लोकस्तदनुवर्तते।।', 'However you do your work today, the people watching you — juniors, new hires — will copy it. Set the standard you''d want them to follow.', 'आज आप अपना काम जैसे करेंगे, आपको देख रहे लोग — जूनियर, नए साथी — वैसा ही करेंगे। वही मानक तय करें जो आप उनसे चाहते हैं।', 'Bhagavad Gita 3.21', 'gita'),

-- Block 11: commitment C1-C4 + Gita 2.40 (new)
(45, 'Commitment shows up most clearly on the days it would be easiest to skip it.', 'प्रतिबद्धता तब सबसे साफ़ दिखती है जब उसे छोड़ना सबसे आसान होता है।', 'If today feels like one of those days, that''s exactly when it matters most.', 'अगर आज वैसा ही दिन लगे, तो यही वह समय है जब यह सबसे ज़्यादा मायने रखता है।', 'Forge OS', 'motivational'),
(46, 'The work you don''t feel like doing today is exactly the work that tests whether your commitment is real.', 'आज जो काम करने का मन नहीं है, वही असली परीक्षा है कि आपकी प्रतिबद्धता सच्ची है या नहीं।', 'Do that one task today anyway.', 'आज वह काम फिर भी करें।', 'Forge OS', 'motivational'),
(47, 'Someone is depending on the part you make today being made right — don''t let distraction cost them that.', 'आज आप जो पार्ट बनाते हैं, कोई उसके सही होने पर निर्भर है — ध्यान भटकने की कीमत उन्हें न चुकानी पड़े।', 'Stay focused on the task at hand, even for a moment''s distraction.', 'आज अपने काम पर ध्यान बनाए रखें, एक पल के लिए भी ध्यान न भटकाएं।', 'Forge OS', 'motivational'),
(48, 'A promise to show up tomorrow is worth little if today''s work is careless.', 'अगर आज का काम लापरवाही से हो, तो कल आने का वादा कम मूल्य का हो जाता है।', 'Today''s carefulness is what makes tomorrow''s promise mean something.', 'आज की सावधानी ही कल के वादे को सार्थक बनाती है।', 'Forge OS', 'motivational'),
(49, 'In this path, no effort is ever lost, and there is no adverse result; even a little practice of this discipline protects one from great fear.', 'नेहाभिक्रमनाशोऽस्ति प्रत्यवायो न विद्यते। स्वल्पमप्यस्य धर्मस्य त्रायते महतो भयात्।।', 'No honest effort you put in today is ever wasted, even if the result isn''t visible right away.', 'आज की हर ईमानदार कोशिश बेकार नहीं जाती, भले ही उसका नतीजा तुरंत दिखे या न दिखे।', 'Bhagavad Gita 2.40', 'gita'),

-- Block 12: commitment C5-C7 + Mahabharata
(50, 'Commitment to a company isn''t about loyalty speeches — it''s about consistency on ordinary Tuesdays.', 'किसी कंपनी के लिए प्रतिबद्धता भाषणों में नहीं है — यह एक सामान्य दिन की निरंतरता में है।', 'Today is probably an ordinary day — be consistent anyway.', 'आज शायद एक सामान्य दिन है — फिर भी निरंतर बने रहें।', 'Forge OS', 'motivational'),
(51, 'The cost of cutting a corner today is usually paid by someone else tomorrow — a coworker, a customer, or you.', 'आज की गई कोई कमी का खर्च अक्सर कल कोई और चुकाता है — साथी, ग्राहक, या खुद आप।', 'Don''t cut a corner today that someone else will have to pay for.', 'आज कोई कमी न करें जिसकी कीमत किसी और को चुकानी पड़े।', 'Forge OS', 'motivational'),
(52, 'Being dependable is a quiet kind of excellence — few people notice it until the day it''s missing.', 'भरोसेमंद होना एक शांत तरह की उत्कृष्टता है — कम ही लोग इसे नोटिस करते हैं, जब तक यह गायब न हो जाए।', 'Be the dependable one today, quietly.', 'आज शांति से भरोसेमंद बने रहें।', 'Forge OS', 'motivational'),
(53, 'Day after day, countless beings pass into the abode of death, yet those who remain wish to live as if forever — what could be more astonishing than this?', 'अहन्यहनि भूतानि गच्छन्तीह यमालयम्। शेषा स्थावरमिच्छन्ति किमाश्चर्यमतः परम्।।', 'Time keeps moving whether we use it well or not — make today count; don''t put off what matters.', 'समय रुकता नहीं, चाहे हम उसका उपयोग करें या नहीं — आज के दिन को सार्थक बनाएं, ज़रूरी काम टालें नहीं।', 'Mahabharata — Yaksha Prashna, Vana Parva', 'mahabharata'),

-- Block 13: commitment C8-C11 + Hanuman Doha1
(54, 'Half-hearted work on a hard day still counts as work left for someone else to finish.', 'कठिन दिन में आधे मन से किया काम भी किसी और के लिए अधूरा छोड़ा गया काम ही माना जाता है।', 'Finish what you start today, even if your heart isn''t fully in it at first.', 'आज जो शुरू करें उसे पूरा करें, भले ही शुरुआत में पूरा मन न लगे।', 'Forge OS', 'motivational'),
(55, 'If you commit to a task, finish it as if your name were stamped on it — because in a real sense, it is.', 'जब कोई काम लें, तो उसे ऐसे पूरा करें जैसे उस पर आपका नाम लिखा हो — क्योंकि असल में वह लिखा ही होता है।', 'Your work today carries your name, even if no one writes it down.', 'आज का काम आपका नाम साथ लेकर चलता है, भले ही कोई उसे लिखे न।', 'Forge OS', 'motivational'),
(56, 'Don''t let a bad morning become a bad shift for everyone around you.', 'एक खराब सुबह को अपने आस-पास के सभी साथियों के लिए खराब शिफ्ट न बनने दें।', 'Reset if you need to today — don''t carry a rough start into the whole shift.', 'ज़रूरत हो तो आज खुद को फिर से संभालें — एक खराब शुरुआत को पूरी शिफ्ट पर असर न डालने दें।', 'Forge OS', 'motivational'),
(57, 'Victory to Hanuman, ocean of wisdom and virtue; victory to the lord of monkeys, who illuminates all three worlds.', 'जय हनुमान ज्ञान गुण सागर। जय कपीस तिहुं लोक उजागर।।', 'True strength comes together with wisdom and good character, not power alone — carry both into your work today.', 'सच्ची शक्ति बुद्धि और अच्छे गुणों के साथ आती है, सिर्फ बल से नहीं — आज अपने काम में दोनों को साथ रखें।', 'Hanuman Chalisa, Doha 1', 'hanuman'),

-- Block 14: commitment C12-C14 + Hanuman Chaupai7
(58, 'The team doesn''t need you to be perfect today — it needs you to be present, honest, and trying.', 'टीम को आज आपसे पूर्णता नहीं चाहिए — उसे आपकी मौजूदगी, ईमानदारी और कोशिश चाहिए।', 'Show up fully today — that''s enough.', 'आज पूरी तरह उपस्थित रहें — यही काफ़ी है।', 'Forge OS', 'motivational'),
(59, 'A small mistake owned honestly costs far less trust than the same mistake hidden.', 'ईमानदारी से मानी गई एक छोटी गलती, छिपाई गई उसी गलती से कहीं कम भरोसा खर्च करती है।', 'If today brings a small mistake, own it plainly.', 'आज कोई छोटी गलती हो तो उसे साफ़ मान लें।', 'Forge OS', 'motivational'),
(60, 'Commitment means your coworkers can plan their own work around knowing yours will get done.', 'प्रतिबद्धता का मतलब है कि आपके साथी इस भरोसे पर अपना काम तय कर सकें कि आपका काम पूरा होगा।', 'Let your coworkers count on today''s work being done, without having to check.', 'आज अपने साथियों को इस भरोसे में रखें कि आपका काम बिना जांचे पूरा होगा।', 'Forge OS', 'motivational'),
(61, 'All troubles are cut away and every pain disappears, for those who remember the mighty, brave Hanuman.', 'संकट कटे मिटे सब पीरा। जो सुमिरै हनुमत बलबीरा।।', 'Facing a tough task today? Approach it with Hanuman''s own fearless, steady confidence.', 'आज कोई मुश्किल काम सामने है? उसे हनुमान जी के निडर और स्थिर आत्मविश्वास के साथ करें।', 'Hanuman Chalisa, Chaupai 7', 'hanuman'),

-- Block 15: commitment C15, bonding D1-D3 + Ramcharitmanas
(62, 'The real test of commitment isn''t the big moments — it''s whether you show up fully on the small, forgettable ones.', 'प्रतिबद्धता की असली परीक्षा बड़े पलों में नहीं, छोटे और भूले जा सकने वाले पलों में होती है।', 'Today is probably one of those forgettable ones — show up fully anyway.', 'आज शायद वैसा ही एक भूला जा सकने वाला दिन है — फिर भी पूरी तरह उपस्थित रहें।', 'Forge OS', 'motivational'),
(63, 'The newest person on your line learns the job from watching how you do yours — make it worth copying.', 'आपकी लाइन का सबसे नया साथी आपका काम देखकर सीखता है — इसे नकल करने लायक बनाएं।', 'Someone might be learning from you today without you even knowing it.', 'आज शायद कोई आपसे सीख रहा हो, बिना आपको पता चले।', 'Forge OS', 'motivational'),
(64, 'Everyone on the floor was new once — the welcome you give today is the welcome someone once gave you.', 'फैक्ट्री में हर कोई कभी नया था — आज आप जो स्वागत करते हैं, वही किसी ने कभी आपको किया था।', 'Pass that welcome forward today.', 'आज वह स्वागत आगे बढ़ाएं।', 'Forge OS', 'motivational'),
(65, 'A new coworker remembers who made their first week easier far longer than they remember any training manual.', 'एक नया साथी यह याद रखता है कि किसने उसका पहला हफ्ता आसान बनाया, किसी ट्रेनिंग मैन्युअल से कहीं ज़्यादा लंबे समय तक।', 'If there''s someone new near you today, be that person.', 'आज अगर कोई नया साथी आस-पास है, तो वही बनें।', 'Forge OS', 'motivational'),
(66, 'Without completing Lord Rama''s task, how could I possibly rest?', 'राम काज कीन्हें बिना, मोहि कहाँ विश्राम।', 'A job you''ve taken on deserves full follow-through — real satisfaction comes only once it''s actually done.', 'जो काम आपने हाथ में लिया है, उसे पूरा करना ज़रूरी है — असली संतोष काम पूरा होने पर ही मिलता है।', 'Ramcharitmanas, Sundarkand', 'hanuman'),

-- Block 16: bonding D4-D5, motivation E1 + Saraswati Vandana
(67, 'Take two minutes today to actually learn a new teammate''s name — it costs nothing and means something.', 'आज दो मिनट निकालकर किसी नए साथी का नाम सच में याद करें — इसकी कोई कीमत नहीं, लेकिन मायने बहुत है।', 'A name remembered today can be the start of real trust.', 'आज याद किया गया एक नाम असली भरोसे की शुरुआत हो सकता है।', 'Forge OS', 'motivational'),
(68, 'The fastest way to build a strong team is one small kindness to the newest person on it.', 'एक मज़बूत टीम बनाने का सबसे तेज़ तरीका है उसके सबसे नए सदस्य के लिए एक छोटी सी दयालुता।', 'Offer one small kindness today to whoever is newest around you.', 'आज अपने आस-पास के सबसे नए साथी के लिए एक छोटी सी दयालुता दिखाएं।', 'Forge OS', 'motivational'),
(69, 'Not every shift feels meaningful while you''re in it — most meaning in work shows up only looking back.', 'हर शिफ्ट उस वक्त सार्थक नहीं लगती — काम का ज़्यादातर मतलब पीछे मुड़कर देखने पर समझ आता है।', 'Trust that today''s effort will make sense later, even if it doesn''t feel that way right now.', 'भरोसा रखें कि आज की कोशिश बाद में सार्थक लगेगी, भले ही अभी वैसा न लगे।', 'Forge OS', 'motivational'),
(70, 'Salutations to you, Goddess Saraswati, giver of boons, who can take any form — I am beginning my learning; may I always attain success.', 'सरस्वती नमस्तुभ्यं वरदे कामरूपिणि। विद्यारम्भं करिष्यामि सिद्धिर्भवतु मे सदा।।', 'Start today''s work the way you''d start a lesson — with an open mind, ready to learn something new.', 'आज का काम भी एक नई शुरुआत की तरह करें — खुले मन से, कुछ नया सीखने के लिए तैयार।', 'Saraswati Vandana (traditional)', 'saraswati'),

-- Block 17: motivation E2-E5 + Saraswati salutation
(71, 'A slow start to the day doesn''t have to mean a slow day — begin again at any hour you choose.', 'दिन की धीमी शुरुआत का मतलब पूरा धीमा दिन नहीं है — आप किसी भी घंटे फिर से शुरुआत कर सकते हैं।', 'If today started slowly, restart it now — it''s not too late.', 'अगर आज की शुरुआत धीमी थी, तो अभी फिर से शुरू करें — देर नहीं हुई।', 'Forge OS', 'motivational'),
(72, 'The work in front of you today doesn''t need your best mood, just your honest effort.', 'आज आपके सामने जो काम है, उसे आपके सबसे अच्छे मूड की ज़रूरत नहीं, सिर्फ आपकी ईमानदार कोशिश की ज़रूरत है।', 'Effort today doesn''t have to wait for the right mood.', 'आज की कोशिश अच्छे मूड का इंतज़ार नहीं करेगी।', 'Forge OS', 'motivational'),
(73, 'Difficult mornings are real — showing up anyway is what separates good work from good intentions.', 'कठिन सुबहें असली होती हैं — फिर भी आना, अच्छे काम और अच्छे इरादे के बीच का फ़र्क़ है।', 'If this morning was hard, showing up today still counts for something real.', 'अगर आज की सुबह कठिन थी, तो फिर भी आना सच में मायने रखता है।', 'Forge OS', 'motivational'),
(74, 'Om, salutations to Saraswati — goddess of knowledge, wisdom, and skill.', 'ॐ सरस्वत्यै नमः।', 'Respect the skill and knowledge your work needs today — good craftsmanship matters.', 'आज के काम में जो कौशल और ज्ञान चाहिए, उसका सम्मान करें — हुनर मायने रखता है।', 'Traditional Saraswati salutation', 'saraswati'),

-- Block 18: motivation E6-E8 + Hitopadesha
(75, 'Today''s shift is one small piece of a much longer story you''re building, shift by shift.', 'आज की शिफ्ट एक बड़ी कहानी का एक छोटा हिस्सा है, जो आप शिफ्ट-दर-शिफ्ट बना रहे हैं।', 'See today as one chapter, not the whole story.', 'आज को एक अध्याय समझें, पूरी कहानी नहीं।', 'Forge OS', 'motivational'),
(76, 'You don''t need to feel motivated to start well — starting well is often what creates the motivation.', 'अच्छी शुरुआत के लिए प्रेरित महसूस करना ज़रूरी नहीं — अच्छी शुरुआत ही अक्सर प्रेरणा बनाती है।', 'Just start today — the motivation can follow.', 'आज बस शुरू करें — प्रेरणा बाद में आ सकती है।', 'Forge OS', 'motivational'),
(77, 'A tired body can still do careful work — slow down rather than let fatigue turn into carelessness.', 'थका हुआ शरीर भी सावधानी से काम कर सकता है — थकान को लापरवाही बनने देने से बेहतर है धीरे काम करें।', 'If you''re tired today, slow down rather than cut corners.', 'आज थके हों तो धीरे काम करें, लापरवाही न करें।', 'Forge OS', 'motivational'),
(78, 'Tasks are accomplished through effort, not through mere wishing — deer do not walk into the mouth of a sleeping lion.', 'उद्यमेन हि सिद्ध्यन्ति कार्याणि न मनोरथैः। न हि सुप्तस्य सिंहस्य प्रविशन्ति मुखे मृगाः।।', 'Wishing for a good outcome isn''t enough — today''s actual effort is what brings real results and prosperity.', 'सिर्फ अच्छे परिणाम की कामना काफी नहीं — आज का वास्तविक प्रयास ही असली परिणाम और समृद्धि लाता है।', 'Hitopadesha', 'lakshmi'),

-- Block 19: motivation E9-E12 + Lakshmi salutation
(79, 'Every skill you have today was once something you didn''t know how to do — keep learning on the job.', 'आज आपके पास जो भी हुनर है, वह कभी ऐसी चीज़ थी जो आप नहीं जानते थे — काम पर सीखते रहें।', 'There''s still something today''s shift can teach you.', 'आज की शिफ्ट अब भी आपको कुछ सिखा सकती है।', 'Forge OS', 'motivational'),
(80, 'The best version of today''s shift is simply a steady one, not a dramatic one.', 'आज की शिफ्ट का सबसे अच्छा रूप एक स्थिर शिफ्ट है, कोई नाटकीय नहीं।', 'Aim for steady, not spectacular, today.', 'आज स्थिरता का लक्ष्य रखें, कुछ असाधारण नहीं।', 'Forge OS', 'motivational'),
(81, 'Progress at work is rarely visible day to day — trust that today''s effort is still adding up.', 'काम में तरक्की रोज़ दिखाई नहीं देती — भरोसा रखें कि आज की कोशिश जुड़ रही है।', 'Today''s effort counts even when you can''t see the result yet.', 'आज की कोशिश तब भी मायने रखती है जब नतीजा अभी न दिखे।', 'Forge OS', 'motivational'),
(82, 'Om, salutations to Goddess Mahalakshmi — giver of prosperity to those who work with honesty and diligence.', 'ॐ श्री महालक्ष्म्यै नमः।', 'Honest, diligent work is the real foundation of lasting prosperity — for you and for the company.', 'ईमानदार और मेहनती काम ही स्थायी समृद्धि की असली नींव है — आपके लिए और कंपनी के लिए भी।', 'Traditional Lakshmi salutation', 'lakshmi'),

-- Block 20: motivation E13-E15 + Gita 17.20 (new)
(83, 'Whatever happened yesterday, today''s shift is a fresh page — write it well.', 'कल जो भी हुआ, आज की शिफ्ट एक नया पन्ना है — उसे अच्छे से लिखें।', 'Let today start clean, regardless of yesterday.', 'आज को साफ़ शुरुआत दें, कल जो भी हुआ हो।', 'Forge OS', 'motivational'),
(84, 'Small, careful work repeated every day outperforms occasional brilliance.', 'हर दिन दोहराया गया छोटा, सावधानी से किया काम कभी-कभार की चमक से बेहतर परिणाम देता है।', 'Aim for careful and consistent today, not flashy.', 'आज सावधान और निरंतर रहने का लक्ष्य रखें, दिखावटी नहीं।', 'Forge OS', 'motivational'),
(85, 'Nobody remembers an easy shift — but everyone remembers who stayed steady through a hard one.', 'आसान शिफ्ट को कोई याद नहीं रखता — लेकिन कठिन शिफ्ट में स्थिर रहने वाले को सब याद रखते हैं।', 'If today turns out hard, staying steady through it is worth something.', 'अगर आज कठिन निकले, तो उसमें स्थिर रहना मायने रखता है।', 'Forge OS', 'motivational'),
(86, 'That gift which is given with the thought that it is one''s duty to give, without expecting anything in return, at the right place and time, to a worthy person — that gift is considered to be in the mode of goodness.', 'दातव्यमिति यद्दानं दीयतेनुपकारिणे। देशे काले च पात्रे च तद्दानं सात्त्विकं स्मृतम्।।', 'Help or kindness given today without expecting anything back is the most genuine kind — look for one small chance to give it.', 'आज बिना किसी बदले की उम्मीद के दी गई मदद या भलाई सबसे असली होती है — ऐसा एक छोटा मौका आज ज़रूर ढूंढें।', 'Bhagavad Gita 17.20', 'gita'),

-- Closing block: a few more gratitude-to-company lines to round out to 90
(87, 'The discipline to show up on an ordinary day is worth more than enthusiasm on an exciting one.', 'एक सामान्य दिन में आने का अनुशासन, किसी रोमांचक दिन के जोश से ज़्यादा मूल्यवान है।', 'Today is likely ordinary — bring discipline to it anyway.', 'आज शायद सामान्य है — फिर भी अनुशासन के साथ काम करें।', 'Forge OS', 'motivational'),
(88, 'A good day at work is built in the first hour''s attitude more than the last hour''s results.', 'काम का एक अच्छा दिन पहले घंटे के रवैये से बनता है, आखिरी घंटे के नतीजों से ज़्यादा।', 'Set the right attitude in this first hour — the rest of the day tends to follow it.', 'इस पहले घंटे में सही रवैया अपनाएं — बाकी दिन अक्सर उसी का अनुसरण करता है।', 'Forge OS', 'motivational'),
(89, 'No one builds anything great alone — be the teammate someone else can count on.', 'कोई भी बड़ा काम अकेले नहीं होता — वह साथी बनें जिस पर दूसरे भरोसा कर सकें।', 'Look out for the person working next to you today.', 'आज अपने साथ काम कर रहे साथी का भी ध्यान रखें।', 'Forge OS', 'motivational'),
(90, 'Start today believing your best effort matters — because it does, to your team, to your family, and to the company that provides for you both.', 'आज यह मानकर शुरुआत करें कि आपकी पूरी मेहनत महत्व रखती है — क्योंकि यह आपकी टीम, आपके परिवार, और आप दोनों का सहारा बनने वाली कंपनी के लिए सच में मायने रखती है।', 'Your work today genuinely matters — to the people around you, your family at home, and Varsha Forgings.', 'आज आपका काम सच में महत्वपूर्ण है — आपके आस-पास के लोगों के लिए, घर पर आपके परिवार के लिए, और वर्षा फोर्जिंग्स के लिए भी।', 'Forge OS', 'motivational');

-- ---------------------------------------------------------------------------
-- VERIFICATION
-- ---------------------------------------------------------------------------
-- select count(*) from public.daily_quotes;                          -- expect 90
-- select * from public.get_quote_of_the_day();                        -- expect exactly 1 row
-- select sort_order, category from public.daily_quotes order by sort_order; -- spot-check interleave
