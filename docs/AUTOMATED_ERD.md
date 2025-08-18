# Automated ERD Generation System

This document describes the automated Entity Relationship Diagram (ERD) generation system that creates interactive ERDs from the CLIF SQL DDL files.

## Overview

The system automatically generates interactive ERDs from the `v-2-1-0-ddl.sql` file, eliminating the need to manually update static ERD images when the schema changes.

## System Components

### 1. SQL Parser (`src/utils/erdParser.js`)

**Purpose**: Parse the CLIF DDL file and extract schema information.

**Features**:
- Custom parser for CLIF DDL format with COMMENT syntax
- Extracts tables, fields, data types, and relationships
- Parses JSON metadata from COMMENT fields
- Categorizes tables (core, medical data, concept)
- Infers relationships from foreign key constraints and naming patterns

**Key Methods**:
- `parseCustomDDL()` - Main DDL parsing logic
- `parseTableColumns()` - Extract field definitions and metadata
- `parseTableForeignKeys()` - Extract relationship constraints
- `extractRelationships()` - Build relationship graph

### 2. Interactive ERD Component (`src/components/InteractiveERD.astro`)

**Purpose**: Render the ERD as an interactive D3.js visualization.

**Features**:
- Color-coded tables by category (red=core, orange=medical, gray=concept)
- Zoom, pan, and reset controls
- Click-to-view table details panel
- Relationship lines showing foreign key connections
- Responsive design with legend and controls

**Styling**:
- Matches the existing CLIF brand colors
- Professional appearance similar to the original static ERD
- Mobile-friendly responsive design

### 3. ERD Page (`src/pages/interactive-erd.astro`)

**Purpose**: Dedicated page for the interactive ERD experience.

**Features**:
- Usage instructions and legend
- Integration with site navigation
- SEO-optimized metadata
- Links back to data dictionary documentation

### 4. Build Integration

**Scripts**:
- `npm run erd:generate` - Generate ERD data manually
- `npm run prebuild` - Auto-generate before builds
- `scripts/generate-erd.js` - Build-time ERD generation script

**Build Process**:
1. `npm run build` triggers `prebuild` automatically
2. ERD data is generated from SQL at build time
3. Static ERD data is saved to `public/data/erd-data.json`
4. Interactive component loads this data at runtime

## Table Categories

The system automatically categorizes tables for color coding:

### Beta Tables (Burgundy)
Complete tables used in federated CLIF projects with defined structure and mCIDE:
- `patient` - Patient demographics
- `hospitalization` - Hospital encounters  
- `adt` - Admission/discharge/transfer data
- `code_status` - Patient code status changes
- `labs` - Laboratory results
- `vitals` - Vital signs measurements
- `respiratory_support` - Ventilator settings
- `medication_admin_continuous` - IV drips and infusions
- `medication_admin_intermittent` - Bolus medications
- `medication_orders` - Medication orders
- `microbiology_culture` - Culture results
- `microbiology_nonculture` - Non-culture microbiology
- `patient_assessments` - Clinical assessments
- `patient_procedures` - Bedside procedures
- `crrt_therapy` - Dialysis therapy data
- `ecmo_mcs` - ECMO/mechanical support
- `invasive_hemodynamics` - Invasive pressure monitoring
- `position` - Patient positioning
- `hospital_diagnosis` - Diagnosis codes
- `transfusion` - Blood product transfusions
- `therapy_details` - Physical/occupational therapy

### Concept Tables (Gray)
Future planned tables and experimental data structures:
- `intake_output` - Fluid balance (concept)
- `key_icu_orders` - Therapy orders (concept)
- `place_based_index` - Geographic indices (concept)
- `provider` - Provider assignments (concept)
- `microbiology_susceptibility` - Antibiotic sensitivity (concept)

## Relationship Detection

The system detects relationships through:

1. **Explicit Foreign Keys**: Parsed from `FOREIGN KEY` constraints in DDL
2. **Naming Patterns**: Fields ending in `_id` are treated as potential foreign keys
3. **Validation**: Relationships are validated against existing tables

## Usage

### Viewing the Interactive ERD

1. Navigate to `/interactive-erd` on the website
2. Use controls to zoom, pan, and reset view
3. Click tables to see detailed field information
4. Use legend to understand color coding

### Updating the ERD

The ERD updates automatically when:

1. **SQL Changes**: Modify `src/content/v-2-1-0-ddl.sql`
2. **Build Process**: Run `npm run build` (includes `prebuild` automatically)
3. **Manual Refresh**: Run `npm run erd:generate` to update immediately

### Development

To test ERD changes during development:

```bash
# Generate ERD data
npm run erd:generate

# Start development server  
npm run dev

# Visit http://localhost:4321/interactive-erd
```

## Integration Points

### Navigation
- Added to Data Dictionary submenu in main navigation
- Mobile navigation includes ERD option

### Documentation Links
- Data dictionary page includes link to interactive ERD
- Interactive ERD page links back to documentation

### Build Process
- Integrated into `package.json` scripts
- Automatic generation during builds
- Manual generation available for development

## Technical Details

### Dependencies
- `d3` - D3.js for interactive visualization
- Custom SQL parser (no external DDL parser dependency)

### Performance
- ERD generation happens at build time, not runtime
- D3.js loads from CDN for optimal performance
- Lazy loading of complex visualizations

### Browser Compatibility
- Modern browsers with ES6+ support
- Fallback handling for missing D3.js
- Progressive enhancement approach

## Future Enhancements

Potential improvements to consider:

1. **Layout Optimization**: Automatic table positioning algorithms
2. **Export Features**: PNG/SVG export functionality
3. **Search/Filter**: Table and field search capabilities
4. **Relationship Details**: Hover tooltips for relationship information
5. **Schema Diff**: Visual comparison between schema versions
6. **Print Optimization**: Print-friendly layout options

## Troubleshooting

### ERD Not Updating
- Ensure SQL file syntax is valid
- Check build logs for parsing errors
- Verify `npm run erd:generate` completes successfully

### Missing Relationships
- Check foreign key constraints in DDL
- Verify table names match exactly (case-sensitive)
- Review relationship inference logic in parser

### Visualization Issues
- Check browser console for D3.js errors
- Verify data structure in `public/data/erd-data.json`
- Test with different browsers

### Build Failures
- Ensure all dependencies are installed (`npm install`)
- Check SQL file accessibility and permissions
- Review error messages in build logs