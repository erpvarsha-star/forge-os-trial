-- PATCH_43: Update is_common form_links with real Google Form URLs
-- Source: VFPL_Department_wise_Forms_2026-27.xlsx (provided by Yash, Sep 2026)
-- Replaces the placeholder https://forms.gle/placeholder-update set in PATCH_41 and PATCH_42.

-- Common forms visible to every role in the My Requests banner
UPDATE form_links SET url = 'https://docs.google.com/forms/d/e/1FAIpQLSd5uTNDfcYLjX_h-GY9UMo-kqgfRzs1BcWtytWAYOqGFPLyAg/viewform'
WHERE department = 'COMMON' AND form_name = 'Leave Application';

UPDATE form_links SET url = 'https://docs.google.com/forms/d/e/1FAIpQLSca0VuecMq0bN4qqTZec9DZDSObC5Av8NS9fDrN3Jp5OTSKgg/viewform'
WHERE department = 'COMMON' AND form_name = 'Advance Application';

UPDATE form_links SET url = 'https://docs.google.com/forms/d/e/1FAIpQLSdckWth804L-MQsJf8P-ndpgSYzpWCAEJZBNlc13fIdt6GqMw/viewform'
WHERE department = 'COMMON' AND form_name = 'Gate Pass';

UPDATE form_links SET url = 'https://docs.google.com/forms/d/e/1FAIpQLSd8mM9kIzpo4y3bj8DV6tTcAdammvf9Kknn350Y7jM9pI_L0w/viewform'
WHERE department = 'COMMON' AND form_name = 'Cash Expenses';

UPDATE form_links SET url = 'https://docs.google.com/forms/d/e/1FAIpQLSe_o-FtVWFJcCqwu0ovG03L4IjzsGQGNzVelCwkuwnk7Pts7g/viewform'
WHERE department = 'COMMON' AND form_name = 'Hospital Form';

-- Cash Advance Voucher — appears on every department list; add as 6th common form if not already present
INSERT INTO form_links (department, form_name, frequency, responsible_person, url, is_active, send_in_reminder, sort_order, is_common)
VALUES ('COMMON', 'Cash Advance Voucher', 'As Required', NULL,
  'https://docs.google.com/forms/d/e/1FAIpQLSerEQLd-rIJMnbkKSN-ddz37ySBPibB0kFF9rXRcrCkGsqe7g/viewform',
  TRUE, FALSE, 0, TRUE)
ON CONFLICT DO NOTHING;

-- Verify the 6 common rows all have real URLs
SELECT form_name, url FROM form_links WHERE is_common = TRUE AND is_active = TRUE ORDER BY sort_order, form_name;
