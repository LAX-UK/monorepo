# Linking lax.art originals to Zoho

Originals that were put on lax.art before the artwork register are not tied to a register record, so
the one-place lock and the moves between lax.art and LAX Bid do not protect them. LAX Admin >
Gallery > From Zoho > **Link lax.art** is the one-off report that fixes this. The tab shows while
any lax.art original is unlinked and hides itself when none are.

## How matching works (read-only)

1. A listing that carries a LAX stock code (its import key is a stock code) matches the record with
   that stock code. A code Zoho does not know is "No match"; the title is not tried instead.
2. Otherwise the listing's artist Zoho artist code plus its title. Several records with that artist
   and title are told apart by size, then year.
3. The title alone never matches: an artist with no Zoho artist code is "No match".
4. A record wanted by two listings is shown to both as "Needs a choice".

Matching never links. **Check again** matches again after Zoho is fixed.

## Linking

- Needs `catalogue.write` and `artwork_register.review` (Catalogue editor, Administrator). Anyone with
  `artwork_register.read` sees the report view-only.
- Zoho is master: where lax.art and Zoho disagree (title, artist, medium, size, year, images), Zoho's
  value replaces lax.art's, including a value Zoho leaves empty, as the nightly linked-listing sync
  would do anyway. The report shows each difference with lax.art's old value struck through. The web
  address is always kept.
- A live listing linked to a record that is Not offered becomes On lax.art, through the same offer
  lock as a publish. A draft stays where it is until it is published. A record held elsewhere (Bid
  sale, sold, sold in the gallery, reserved in Zoho) refuses the link with the lock's message.
- Bulk confirmation links Matched rows only; the server matches each pair again first.
- Repeating a link is safe and changes nothing.

## One artwork

An unlinked original's page has **Link to Zoho record…** (search by stock code, title or artist, then
the same preview). Unlinking (`artwork_register.unlink`, Administrator only) needs a reason and is
refused while the artwork is in a Bid sale. Every link and unlink is recorded in the record's history
with who and why.

## Blocking publishing of unlinked originals

Settings on the report: **Block publishing unlinked originals** (Administrator, `settings.write`).
It starts off. Turn it on once the report is done. Stored in `shop_catalogue_setting`
(`block_unlinked_publish`).
