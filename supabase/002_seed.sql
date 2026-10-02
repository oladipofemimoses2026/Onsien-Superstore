-- Catalogue from PRD.md. Run once, after 001_schema.sql.
-- Expect 8 products and 14 variants (stock defaults to 25).

insert into products (slug, name, description, sort_order) values
  ('yaji-suya-spice',  'Yaji Suya Spice',         'Kano-style suya pepper: groundnut, ginger, cayenne.',        1),
  ('ata-dindin',       'Ata Dindin Pepper Sauce', 'Slow-fried tatashe and scotch bonnet in oil.',               2),
  ('zobo-mix',         'Zobo Mix',                'Dried hibiscus with ginger, clove and pineapple peel.',      3),
  ('crayfish-powder',  'Crayfish Powder',         'Sun-dried crayfish, finely ground, no sand.',                4),
  ('ground-egusi',     'Ground Egusi',            'Cleaned, milled melon seed for soup.',                       5),
  ('ofada-stew-base',  'Ofada Stew Base',         'Green pepper and locust bean base. Just add protein.',       6),
  ('ehuru',            'Ehuru',                   'Whole calabash nutmeg for pepper soup and ofe nsala.',       7),
  ('red-palm-oil',     'Red Palm Oil',            'Unbleached oil from a single Imo farm.',                     8);

insert into product_variants (product_id, label, price_kobo, sort_order)
select p.id, v.label, v.price_kobo, v.sort_order
  from (values
    ('yaji-suya-spice', '100g',  250000, 1),
    ('yaji-suya-spice', '250g',  500000, 2),
    ('ata-dindin',      '250ml', 350000, 1),
    ('ata-dindin',      '500ml', 600000, 2),
    ('zobo-mix',        '200g',  200000, 1),
    ('zobo-mix',        '500g',  450000, 2),
    ('crayfish-powder', '200g',  400000, 1),
    ('crayfish-powder', '500g',  900000, 2),
    ('ground-egusi',    '500g',  550000, 1),
    ('ground-egusi',    '1kg',  1000000, 2),
    ('ofada-stew-base', '500ml', 750000, 1),
    ('ehuru',           '50g',   300000, 1),
    ('red-palm-oil',    '1L',    450000, 1),
    ('red-palm-oil',    '2L',    850000, 2)
  ) as v (slug, label, price_kobo, sort_order)
  join products p on p.slug = v.slug;
