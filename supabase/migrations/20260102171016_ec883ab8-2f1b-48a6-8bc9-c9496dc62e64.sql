-- Add missing default Current Stage options for all factories
-- This inserts stages that don't already exist (based on code)

INSERT INTO stages (factory_id, code, name, sequence, is_active)
SELECT f.id, s.code, s.name, s.sequence, true
FROM factory_accounts f
CROSS JOIN (
  VALUES 
    ('PRE_PROD', 'Pre Production', 1),
    ('MAT_INHOUSE', 'Materials In-House', 2),
    ('CUT', 'Cutting', 3),
    ('SEW', 'Sewing', 4),
    ('PROCESS', 'Process (Wash/Print/Embroidery)', 5),
    ('FINISH', 'Finishing', 6),
    ('PACK', 'Packing', 7),
    ('FINAL_QC', 'Final QC', 8),
    ('READY_SHIP', 'Ready for Shipment', 9),
    ('SHIPPED', 'Shipped', 10),
    ('ON_HOLD', 'On Hold', 11)
) AS s(code, name, sequence)
WHERE NOT EXISTS (
  SELECT 1 FROM stages 
  WHERE stages.factory_id = f.id 
  AND stages.code = s.code
);