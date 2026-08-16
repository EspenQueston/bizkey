-- Seeds BizKey's own (client_id null / admin-owned) knowledge base and
-- auto-reply rules with WIVICH TRADING COMPANY's real WhatsApp FAQ content
-- (pricing, delays, contacts, addresses, transfer rates, payment terms).
-- This is the factual, customer-facing content extracted from WIVICH's
-- n8n AI Agent system prompt — the persona/tone/behavioral rules in that
-- prompt stay in n8n (there's no field for "how the agent should act" in
-- this schema), only what a customer would actually ask about lives here.
--
-- Runs at client_id is null because WIVICH's WhatsApp Business number isn't
-- provisioned as a paying assistant_clients tenant yet — same admin-owned
-- scope the public /aide page and website widget already read from.

with inserted_articles as (
  insert into public.whatsapp_kb_articles (title, keywords, answer, is_active, client_id)
  values
    ('Présentation de WIVICH', array['wivich','société','entreprise','services','présentation','qui êtes-vous','que faites-vous'],
     'WIVICH TRADING COMPANY est une société multiservices basée en Chine 🇨🇳. On fait notamment l''import-export, le transport aérien et maritime, le commerce international, le sourcing et les transferts d''argent entre la Chine et plusieurs pays, dont la République du Congo, la RDC, la France, le Royaume-Uni, les USA, le Canada et la Belgique.',
     true, null::uuid),

    ('Tarifs aérien — Brazzaville', array['brazza','brazzaville','tarif brazzaville','prix brazzaville','kilo brazzaville'],
     'Pour Brazzaville, tu as deux options :

✈️ Normal : *9 000 FCFA/kg* — 10 à 12 jours
⚡ Express : *14 000 FCFA/kg* — 3 à 4 jours

Donne-moi le poids et je te calcule le total.',
     true, null::uuid),

    ('Tarifs aérien — Pointe-Noire', array['pointe-noire','pointe noire','pnr','tarif pointe-noire'],
     'Pour Pointe-Noire :

✈️ Normal : *9 000 FCFA/kg* — environ 10 jours
⚡ Express : *14 000 FCFA/kg* — 3 à 4 jours

Donne-moi le poids et je te calcule le total.',
     true, null::uuid),

    ('Tarifs aérien — Kinshasa et Lubumbashi', array['kinshasa','lubumbashi','rdc','tarif kinshasa','tarif lubumbashi'],
     'Pour Kinshasa et Lubumbashi :

✈️ Normal : *16,5 USD/kg* — 10 à 12 jours
⚡ Express : *21 USD/kg* — 3 à 4 jours

Donne-moi le poids et je te calcule le total.',
     true, null::uuid),

    ('Articles spéciaux — Brazzaville / Pointe-Noire', array['téléphone brazzaville','ordinateur brazzaville','tablette','électronique','montre','médicament','cosmétique','article spécial'],
     'Pour Brazzaville et Pointe-Noire :

📱 Téléphone : *20 000 FCFA* la pièce
💻 Ordinateur : *45 000 FCFA* la pièce
📲 Tablette : *25 000 FCFA* la pièce

Électronique, montres, médicaments, cosmétiques, liquides, aliments : *14 000 FCFA/kg*

Délai : 3 à 4 jours.',
     true, null::uuid),

    ('Articles spéciaux — Kinshasa / Lubumbashi', array['téléphone kinshasa','ordinateur kinshasa','tablette kinshasa'],
     'Pour Kinshasa et Lubumbashi :

📱 Téléphone : *25 USD* la pièce
💻 Ordinateur : *65 USD* la pièce
📲 Tablette : *40 USD* la pièce

Électronique, montres, médicaments, cosmétiques, liquides, aliments : *23 USD/kg*

Délai : 3 à 4 jours.',
     true, null::uuid),

    ('Transport maritime', array['bateau','maritime','cbm','ball','conteneur'],
     'Transport maritime (CBM ou BALL) :

🚢 Brazzaville : *270 000 FCFA*
🚢 Pointe-Noire : *230 000 FCFA*
🚢 Kinshasa : *550 USD*

Délai annoncé : 55 à 60 jours. C''est pour quelle ville ?',
     true, null::uuid),

    ('Transfert d''argent', array['transfert','argent','transfert d''argent','envoyer de l''argent','money transfer'],
     'On fait aussi les transferts d''argent, notamment Congo-Brazzaville, RDC, France et USA vers la Chine, et de la Chine vers les deux Congo (0 frais). Taux de référence : *1 yuan = 90 FCFA* — à confirmer le jour de l''opération.',
     true, null::uuid),

    ('Conversion FCFA / Yuan', array['taux','change','conversion','yuan','fcfa'],
     'Avec le taux de référence de *1 yuan = 90 FCFA* :

FCFA → yuan : montant ÷ 90
Yuan → FCFA : montant × 90

Donne-moi le montant et je te calcule ça. Le taux du jour reste à confirmer avant le transfert.',
     true, null::uuid),

    ('Suivi de colis', array['suivi','tracking','où est mon colis','wtc'],
     'Envoie-moi ton numéro de suivi WTC et je vérifie ça tout de suite 📦',
     true, null::uuid),

    ('Contacts officiels', array['contact','numéro','téléphone','agence','joindre'],
     'Voici nos contacts :

📞 Brazzaville : +242 06 474 21 72
📞 Pointe-Noire : +242 06 436 26 07
📞 Kinshasa : +243 835 172 116
📞 Chine : +86 132 5052 8071

Tu es dans quelle ville ?',
     true, null::uuid),

    ('Adresse de réception en Chine — envoi par avion', array['adresse chine avion','adresse avion','envoi avion','adresse réception'],
     'Adresse de réception pour un envoi par avion :

收件人: 克里斯
手机号码: 135 3501 0252
详细地址: 广州市越秀区广园西路27号国太国际商贸城五楼5107档（国太精品酒店）',
     true, null::uuid),

    ('Adresse de réception en Chine — envoi par bateau', array['adresse chine bateau','adresse bateau','envoi bateau'],
     'Adresse de réception pour un envoi par bateau (indique ton nom, ton téléphone + ta référence CHR sur le colis) :

15875315641
广东省广州市白云区江高镇双岗
岗神路181号（导航：金德龙）',
     true, null::uuid),

    ('Paiement — 50% avant expédition', array['paiement','payer','facture','avance','moitié'],
     'Le paiement se fait en deux temps : tu règles *la moitié de la facture* avant que ton colis quitte la Chine, que ce soit par avion ou par bateau.',
     true, null::uuid),

    ('Recherche de produits (sourcing 1688)', array['sourcing','rechercher un produit','1688','trouver un produit','fournisseur'],
     'On peut aussi te trouver des produits directement en Chine (1688). Décris-moi ce que tu cherches (type, quantité, taille, couleur, budget...) et je te propose jusqu''à 3 options avec le prix fournisseur en yuan.',
     true, null::uuid)
  returning id, title
)
insert into public.whatsapp_auto_replies (trigger_type, trigger_value, kb_article_id, response_text, is_active, sort_order, client_id)
select 'greeting', null, null::uuid,
  'Salut 👋 Bienvenue chez WIVICH. Tu veux des infos pour un colis, un transfert d''argent ou un autre service ?',
  true, 0, null::uuid
union all
select 'keyword', 'brazza', id, null, true, 1, null::uuid from inserted_articles where title = 'Tarifs aérien — Brazzaville'
union all
select 'keyword', 'pointe-noire', id, null, true, 2, null::uuid from inserted_articles where title = 'Tarifs aérien — Pointe-Noire'
union all
select 'keyword', 'pointe noire', id, null, true, 3, null::uuid from inserted_articles where title = 'Tarifs aérien — Pointe-Noire'
union all
select 'keyword', 'pnr', id, null, true, 4, null::uuid from inserted_articles where title = 'Tarifs aérien — Pointe-Noire'
union all
select 'keyword', 'kinshasa', id, null, true, 5, null::uuid from inserted_articles where title = 'Tarifs aérien — Kinshasa et Lubumbashi'
union all
select 'keyword', 'lubumbashi', id, null, true, 6, null::uuid from inserted_articles where title = 'Tarifs aérien — Kinshasa et Lubumbashi'
union all
select 'keyword', 'bateau', id, null, true, 7, null::uuid from inserted_articles where title = 'Transport maritime'
union all
select 'keyword', 'transfert', id, null, true, 8, null::uuid from inserted_articles where title = 'Transfert d''argent'
union all
select 'keyword', 'taux', id, null, true, 9, null::uuid from inserted_articles where title = 'Conversion FCFA / Yuan'
union all
select 'keyword', 'suivi', id, null, true, 10, null::uuid from inserted_articles where title = 'Suivi de colis'
union all
select 'keyword', 'contact', id, null, true, 11, null::uuid from inserted_articles where title = 'Contacts officiels'
union all
select 'keyword', '1688', id, null, true, 12, null::uuid from inserted_articles where title = 'Recherche de produits (sourcing 1688)'
union all
select 'keyword', 'paiement', id, null, true, 13, null::uuid from inserted_articles where title = 'Paiement — 50% avant expédition'
union all
select 'fallback', null, null::uuid,
  'Là, il vaut mieux qu''un membre de l''équipe vérifie directement ta demande. Je transmets ça pour vérification 👍',
  true, 20, null::uuid;

-- The pre-existing generic "livraison" rule predates WIVICH's real content
-- and would otherwise fire before the new city-specific rules on any
-- message combining "livraison" with a city name (deterministic matching
-- returns the first sort_order match, not the most specific one) — bump it
-- to run after everything above instead of deleting it.
update public.whatsapp_auto_replies
set sort_order = 15
where client_id is null and trigger_type = 'keyword' and trigger_value = 'livraison';
