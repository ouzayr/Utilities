-- Seed a small sample schema for testing sqlutil.
-- Creates a database "SqlutilSample" with tables exercising PK, FK, indexes,
-- views, stored procedures, PII-like columns, and a heap table.

IF DB_ID('SqlutilSample') IS NULL
    CREATE DATABASE SqlutilSample;
GO

USE SqlutilSample;
GO

IF OBJECT_ID('sales.order_item', 'U') IS NOT NULL DROP TABLE sales.order_item;
IF OBJECT_ID('sales.[order]', 'U') IS NOT NULL DROP TABLE sales.[order];
IF OBJECT_ID('sales.product', 'U') IS NOT NULL DROP TABLE sales.product;
IF OBJECT_ID('sales.customer', 'U') IS NOT NULL DROP TABLE sales.customer;
IF OBJECT_ID('sales.audit_log_heap', 'U') IS NOT NULL DROP TABLE sales.audit_log_heap;
IF OBJECT_ID('sales.v_customer_orders', 'V') IS NOT NULL DROP VIEW sales.v_customer_orders;
IF OBJECT_ID('sales.sp_customer_revenue', 'P') IS NOT NULL DROP PROCEDURE sales.sp_customer_revenue;
IF SCHEMA_ID('sales') IS NULL EXEC('CREATE SCHEMA sales');
GO

CREATE TABLE sales.customer (
    customer_id   INT IDENTITY(1,1) CONSTRAINT PK_customer PRIMARY KEY,
    first_name    NVARCHAR(100) NOT NULL,
    last_name     NVARCHAR(100) NOT NULL,
    email         NVARCHAR(256) NOT NULL,
    phone         NVARCHAR(40)  NULL,
    created_at    DATETIME      NOT NULL CONSTRAINT DF_customer_created DEFAULT(GETDATE())
);
GO

CREATE TABLE sales.product (
    product_id    INT IDENTITY(1,1) CONSTRAINT PK_product PRIMARY KEY,
    sku           NVARCHAR(32)  NOT NULL CONSTRAINT UQ_product_sku UNIQUE,
    name          NVARCHAR(200) NOT NULL,
    price         FLOAT         NOT NULL,  -- intentionally float (rule_schema.float_money)
    description   NVARCHAR(MAX) NULL        -- intentionally nvarchar(max) (rule_schema.text_max)
);
GO

CREATE TABLE sales.[order] (
    order_id      INT IDENTITY(1,1) CONSTRAINT PK_order PRIMARY KEY,
    customer_id   INT NOT NULL,             -- FK without supporting index (rule_idx.fk_missing_index)
    order_date    DATETIME NOT NULL,
    total_amount  DECIMAL(18,2) NOT NULL,
    CONSTRAINT FK_order_customer FOREIGN KEY (customer_id) REFERENCES sales.customer(customer_id)
);
GO

CREATE TABLE sales.order_item (
    order_item_id INT IDENTITY(1,1) CONSTRAINT PK_order_item PRIMARY KEY,
    order_id      INT NOT NULL,
    product_id    INT NOT NULL,
    quantity      INT NOT NULL,
    unit_price    DECIMAL(18,2) NOT NULL,
    CONSTRAINT FK_order_item_order   FOREIGN KEY (order_id)   REFERENCES sales.[order](order_id),
    CONSTRAINT FK_order_item_product FOREIGN KEY (product_id) REFERENCES sales.product(product_id)
);
-- supporting index on one FK to show the checker distinguishes
CREATE NONCLUSTERED INDEX IX_order_item_product ON sales.order_item(product_id);
GO

-- heap table (no clustered index) with enough rows to trigger the check
CREATE TABLE sales.audit_log_heap (
    id            INT NOT NULL,
    event         NVARCHAR(200) NOT NULL,
    actor_ip      NVARCHAR(64)  NULL
);
GO

CREATE VIEW sales.v_customer_orders AS
SELECT c.customer_id, c.email, o.order_id, o.total_amount, o.order_date
FROM sales.customer c
JOIN sales.[order] o ON o.customer_id = c.customer_id;
GO

CREATE PROCEDURE sales.sp_customer_revenue @customer_id INT AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.customer_id, c.email, SUM(o.total_amount) AS revenue
    FROM sales.customer c
    JOIN sales.[order] o ON o.customer_id = c.customer_id
    WHERE c.customer_id = @customer_id
    GROUP BY c.customer_id, c.email;
END;
GO

-- a few rows so row_count-based checks fire
INSERT INTO sales.customer (first_name, last_name, email, phone)
SELECT TOP (500)
    CONCAT('First', n.n) AS first_name,
    CONCAT('Last', n.n) AS last_name,
    CONCAT('user', n.n, '@example.com') AS email,
    CASE WHEN n.n % 3 = 0 THEN CONCAT('+1-555-0100', RIGHT('000' + CAST(n.n AS NVARCHAR(10)), 3)) ELSE NULL END
FROM (
    SELECT TOP (500) ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS n
    FROM sys.all_objects a CROSS JOIN sys.all_objects b
) n;

INSERT INTO sales.product (sku, name, price, description)
SELECT TOP (200)
    CONCAT('SKU-', RIGHT('00000' + CAST(n.n AS NVARCHAR(10)), 5)),
    CONCAT('Product ', n.n),
    RAND(CHECKSUM(NEWID())) * 100,
    NULL
FROM (
    SELECT TOP (200) ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS n
    FROM sys.all_objects
) n;

INSERT INTO sales.[order] (customer_id, order_date, total_amount)
SELECT TOP (2000)
    (n.n % 500) + 1,
    DATEADD(DAY, -(n.n % 365), GETDATE()),
    CAST(RAND(CHECKSUM(NEWID())) * 1000 AS DECIMAL(18,2))
FROM (
    SELECT TOP (2000) ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS n
    FROM sys.all_objects a CROSS JOIN sys.all_objects b
) n;

INSERT INTO sales.order_item (order_id, product_id, quantity, unit_price)
SELECT TOP (5000)
    (n.n % 2000) + 1,
    (n.n % 200) + 1,
    ((n.n % 5) + 1),
    CAST(RAND(CHECKSUM(NEWID())) * 50 AS DECIMAL(18,2))
FROM (
    SELECT TOP (5000) ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS n
    FROM sys.all_objects a CROSS JOIN sys.all_objects b
) n;

INSERT INTO sales.audit_log_heap (id, event, actor_ip)
SELECT TOP (1200) n.n, CONCAT('evt_', n.n), '10.0.0.1'
FROM (
    SELECT TOP (1200) ROW_NUMBER() OVER (ORDER BY (SELECT 1)) AS n
    FROM sys.all_objects
) n;
GO
