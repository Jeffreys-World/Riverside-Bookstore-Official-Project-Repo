-- 0036_fix_got_description.sql
--
-- Follow-up to 0035. That migration corrected "A Game of Thrones"'s ISBN
-- (9780553380163 -> 9780553386790) and cover_url, but the `description`
-- column was left on the text that came in with the wrong ISBN — the
-- publisher blurb for "A Brief History of Time" ("A landmark volume in
-- science writing by one of the great minds of our time, Stephen Hawking's
-- book explores such profound questions as..."). It showed on the catalog
-- card and in the product detail drawer.
--
-- Repoint it to the Bantam mass-market edition blurb that matches the
-- corrected ISBN/cover.

begin;

update books
   set description = '#1 NEW YORK TIMES BESTSELLER • The book behind the HBO series GAME OF THRONES, now a definitive collector''s edition. Long ago, in a time forgotten, a preternatural event threw the seasons out of balance. In a land where summers can last decades and winters a lifetime, trouble is brewing. The cold is returning, and in the frozen wastes to the north of Winterfell, sinister forces are massing beyond the kingdom''s protective Wall. To the south, the king''s powers are failing—his most trusted adviser dead under mysterious circumstances and his enemies emerging from the shadows of the throne. At the center of the conflict lie the Starks of Winterfell, a family as harsh and unyielding as the frozen land they were born to. Now Lord Eddard Stark is reluctantly summoned to serve as the king''s new Hand, an appointment that threatens to sunder not only his family but the kingdom itself. Sweeping from a harsh land of cold to a summertime kingdom of epicurean plenty, A Game of Thrones tells a tale of lords and ladies, soldiers and sorcerers, assassins and bastards, who come together in a time of grim omens. Here an enigmatic band of warriors bear swords of no human metal; a tribe of fierce wildlings carry men off into madness; a cruel young dragon prince barters his sister to win back his throne; a child is lost in the twilight between life and death; and a determined woman undertakes a treacherous journey to protect all she holds dear. Amid plots and counter-plots, tragedy and betrayal, victory and terror, allies and enemies, the Starks will be tested, as will their friends and their foes—as an entire world tumbles toward war.'
 where isbn = '9780553386790';

commit;
