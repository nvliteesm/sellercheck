-- FAKE SQL dump for SellerCheck demo. Names, IDs and emails are invented.
CREATE TABLE members (
  id INT PRIMARY KEY,
  full_name VARCHAR(80),
  id_number CHAR(9),
  email VARCHAR(120),
  tier VARCHAR(10)
);

INSERT INTO members VALUES (1, 'Lim Boon Huat', 'S7700321E', 'boonhuat.lim@example.com', 'gold');
INSERT INTO members VALUES (2, 'Maria Santos', 'F9900456T', 'maria.santos@example.com', 'silver');
INSERT INTO members VALUES (3, 'Nguyen Van An', 'G5512789T', 'van.an@example.com', 'silver');
-- Row 4 has a mistyped ID (wrong check letter), so SellerCheck should ignore it.
INSERT INTO members VALUES (4, 'Chua Hui Min', 'S7700321A', 'huimin.chua@example.com', 'bronze');
