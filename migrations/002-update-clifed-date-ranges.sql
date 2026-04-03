-- Update clifed_date_range and revert source_data_date_range to originals
-- Run via: turso db shell clif-consortium < migrations/002-update-clifed-date-ranges.sql

-- Fix clifed_date_range
UPDATE site_details SET clifed_date_range = '2018-2025' WHERE site_name = 'University of Chicago';
UPDATE site_details SET clifed_date_range = '2018-2025' WHERE site_name = 'Rush University';
UPDATE site_details SET clifed_date_range = '2016-2025' WHERE site_name = 'Oregon Health & Science University';
UPDATE site_details SET clifed_date_range = '2011-2025' WHERE site_name = 'University of Minnesota';
UPDATE site_details SET clifed_date_range = '2017-2025' WHERE site_name = 'Johns Hopkins University';
UPDATE site_details SET clifed_date_range = '2022-2025' WHERE site_name = 'Emory University';
UPDATE site_details SET clifed_date_range = '2017-2025' WHERE site_name = 'University of Pennsylvania';
UPDATE site_details SET clifed_date_range = '2013-2021' WHERE site_name = 'University of Toronto';
UPDATE site_details SET clifed_date_range = '2011-2025' WHERE site_name = 'University of California San Francisco';
UPDATE site_details SET clifed_date_range = NULL WHERE site_name = 'Harvard University';
UPDATE site_details SET clifed_date_range = NULL WHERE site_name = 'University of Colorado';

-- Revert source_data_date_range to original values
UPDATE site_details SET source_data_date_range = '2018-2024' WHERE site_name = 'University of Chicago';
UPDATE site_details SET source_data_date_range = '2018-2024' WHERE site_name = 'Rush University';
UPDATE site_details SET source_data_date_range = '2016-2024' WHERE site_name = 'Oregon Health & Science University';
UPDATE site_details SET source_data_date_range = '2011-2024' WHERE site_name = 'University of Minnesota';
UPDATE site_details SET source_data_date_range = 'July 2017 - Onwards' WHERE site_name = 'Johns Hopkins University';
UPDATE site_details SET source_data_date_range = '2022-2024' WHERE site_name = 'Emory University';
UPDATE site_details SET source_data_date_range = 'July 2017 - Onwards' WHERE site_name = 'University of Pennsylvania';
UPDATE site_details SET source_data_date_range = 'January 2017-September 2021' WHERE site_name = 'University of Toronto';
UPDATE site_details SET source_data_date_range = '2011 - Onwards' WHERE site_name = 'University of California San Francisco';
