import fs from 'fs';
import path from 'path';

/**
 * Parse SQL DDL file and extract schema information for ERD generation
 */
export class ERDParser {
  constructor() {
    this.tableCategories = {
      // Beta tables (burgundy) - Core and medical data tables
      beta: [
        'patient', 'hospitalization', 'adt', 'code_status',
        'labs', 'vitals', 'respiratory_support', 'medication_admin_continuous', 
        'medication_admin_intermittent', 'medication_orders', 'microbiology_culture',
        'microbiology_nonculture', 'patient_assessments', 'patient_procedures',
        'crrt_therapy', 'ecmo_mcs', 'invasive_hemodynamics', 'position',
        'hospital_diagnosis', 'transfusion', 'therapy_details'
      ],
      
      // Concept tables (gray) - Future/planned tables
      concept: [
        'intake_output', 'key_icu_orders', 'place_based_index', 'provider',
        'microbiology_susceptibility'
      ]
    };
  }

  /**
   * Parse SQL DDL file and return structured schema
   */
  async parseDDL(sqlFilePath) {
    try {
      const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
      
      // Use custom parser for CLIF DDL format
      const parsedSchema = this.parseCustomDDL(sqlContent);

      // Process and enhance the schema
      const processedSchema = this.processSchema(parsedSchema, sqlContent);
      
      return processedSchema;
    } catch (error) {
      console.error('Error parsing DDL:', error);
      throw error;
    }
  }

  /**
   * Custom DDL parser for CLIF format with COMMENT syntax
   */
  parseCustomDDL(sqlContent) {
    const tables = {};
    
    // Split by CREATE TABLE statements
    const tableRegex = /CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\);/gi;
    let match;
    
    while ((match = tableRegex.exec(sqlContent)) !== null) {
      const tableName = match[1];
      const tableDefinition = match[2];
      
      tables[tableName] = {
        type: 'table',
        name: tableName,
        columns: this.parseTableColumns(tableDefinition),
        foreignKeys: this.parseTableForeignKeys(tableDefinition)
      };
    }
    
    return tables;
  }

  /**
   * Parse columns from table definition
   */
  parseTableColumns(tableDefinition) {
    const columns = {};
    
    // Remove foreign key constraints for column parsing
    const cleanDef = tableDefinition.replace(/FOREIGN KEY.*$/gmi, '').trim();
    
    // Split by lines and parse each field
    const lines = cleanDef.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and foreign key constraints
      if (!trimmedLine || trimmedLine.startsWith('FOREIGN KEY') || trimmedLine === ',') {
        continue;
      }
      
      // Parse field definition
      const fieldMatch = trimmedLine.match(/^(\w+)\s+(\w+(?:\(\d+\))?)\s*(.*?)(?:,\s*)?$/);
      
      if (fieldMatch) {
        const [, fieldName, fieldType, rest] = fieldMatch;
        
        // Parse comment for field metadata
        const commentMatch = rest.match(/COMMENT\s*'({.*?})'/);
        let comment = null;
        if (commentMatch) {
          try {
            comment = JSON.parse(commentMatch[1]);
          } catch (e) {
            comment = { description: commentMatch[1] };
          }
        }
        
        columns[fieldName] = {
          name: fieldName,
          type: fieldType,
          dataType: fieldType.replace(/\(\d+\)/, ''),
          nullable: !rest.includes('NOT NULL'),
          primaryKey: rest.includes('PRIMARY KEY'),
          comment: comment,
          rawDefinition: rest
        };
      }
    }
    
    return columns;
  }

  /**
   * Parse foreign key constraints from table definition
   */
  parseTableForeignKeys(tableDefinition) {
    const foreignKeys = [];
    
    // Look for FOREIGN KEY constraints
    const fkRegex = /FOREIGN KEY\s*\((\w+)\)\s*REFERENCES\s*(\w+)\s*\((\w+)\)/gi;
    let match;
    
    while ((match = fkRegex.exec(tableDefinition)) !== null) {
      const [, column, referencedTable, referencedColumn] = match;
      
      foreignKeys.push({
        column,
        referencedTable,
        referencedColumn,
        columns: [column],
        referencedColumns: [referencedColumn]
      });
    }
    
    return foreignKeys;
  }

  /**
   * Process raw schema and add ERD-specific information
   */
  processSchema(schema, sqlContent) {
    const tables = [];
    const relationships = [];

    // Process each table
    for (const [tableName, tableSchema] of Object.entries(schema)) {
      if (tableSchema.type === 'table') {
        const tableInfo = this.processTable(tableName, tableSchema, sqlContent);
        tables.push(tableInfo);
        
        // Extract relationships
        const tableRelationships = this.extractRelationships(tableName, tableSchema);
        relationships.push(...tableRelationships);
      }
    }

    // Validate relationships - filter out those pointing to non-existent tables
    const tableNames = new Set(tables.map(t => t.name));
    const validRelationships = relationships.filter(rel => 
      tableNames.has(rel.from) && tableNames.has(rel.to)
    );

    return {
      tables,
      relationships: validRelationships,
      metadata: {
        totalTables: tables.length,
        categories: this.getCategoryCounts(tables),
        totalRelationships: validRelationships.length
      }
    };
  }

  /**
   * Process individual table information
   */
  processTable(tableName, tableSchema, sqlContent) {
    const category = this.getTableCategory(tableName);
    const fields = this.processFields(tableSchema.columns || {});
    const comments = this.extractTableComments(tableName, sqlContent);

    return {
      name: tableName,
      displayName: this.formatTableName(tableName),
      category,
      color: this.getCategoryColor(category),
      fields,
      primaryKeys: this.extractPrimaryKeys(tableSchema),
      foreignKeys: this.extractForeignKeys(tableSchema),
      comments,
      position: this.getTablePosition(tableName, category) // For layout
    };
  }

  /**
   * Process table fields/columns
   */
  processFields(columns) {
    const fields = [];
    
    for (const [fieldName, fieldSchema] of Object.entries(columns)) {
      const field = {
        name: fieldName,
        type: this.formatDataType(fieldSchema.type || fieldSchema.dataType),
        nullable: fieldSchema.nullable !== false,
        isPrimaryKey: fieldSchema.primaryKey === true,
        isForeignKey: fieldSchema.references !== undefined,
        comment: this.extractFieldComment(fieldSchema),
        references: fieldSchema.references
      };
      
      fields.push(field);
    }

    return fields;
  }

  /**
   * Extract relationships between tables
   */
  extractRelationships(tableName, tableSchema) {
    const relationships = [];

    // Check table-level foreign keys first
    if (tableSchema.foreignKeys && tableSchema.foreignKeys.length > 0) {
      for (const fk of tableSchema.foreignKeys) {
        relationships.push({
          from: tableName,
          to: fk.referencedTable,
          fromField: fk.column,
          toField: fk.referencedColumn,
          type: 'foreign_key'
        });
      }
    }

    // Also check for implicit foreign keys by field name patterns
    const columns = tableSchema.columns || {};
    for (const [fieldName, fieldSchema] of Object.entries(columns)) {
      // Look for fields that end with _id and might be foreign keys
      if (fieldName.endsWith('_id')) {
        // Special handling for organism_id - it links between microbiology tables
        if (fieldName === 'organism_id') {
          // Skip if we already have this relationship from explicit foreign keys
          const existingRel = relationships.find(rel => 
            rel.from === tableName && rel.fromField === fieldName
          );
          
          if (!existingRel) {
            // Create bidirectional relationships for organism_id
            if (tableName === 'microbiology_culture') {
              relationships.push({
                from: tableName,
                to: 'microbiology_susceptibility',
                fromField: fieldName,
                toField: fieldName,
                type: 'organism_link'
              });
            } else if (tableName === 'microbiology_susceptibility') {
              relationships.push({
                from: tableName,
                to: 'microbiology_culture',
                fromField: fieldName,
                toField: fieldName,
                type: 'organism_link'
              });
            }
          }
        } else {
          // Try to infer the referenced table from the field name
          const potentialTable = fieldName.replace('_id', '');
          
          // Skip if we already have this relationship from explicit foreign keys
          const existingRel = relationships.find(rel => 
            rel.from === tableName && rel.fromField === fieldName
          );
          
          if (!existingRel) {
            // Add as potential relationship (we'll validate this exists later)
            relationships.push({
              from: tableName,
              to: potentialTable,
              fromField: fieldName,
              toField: 'id', // Most tables use 'id' as primary key
              type: 'inferred_foreign_key'
            });
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Determine table category based on name
   */
  getTableCategory(tableName) {
    if (this.tableCategories.beta.includes(tableName)) {
      return 'beta';
    } else if (this.tableCategories.concept.includes(tableName)) {
      return 'concept';
    } else {
      return 'beta'; // Default to beta
    }
  }

  /**
   * Get color for table category
   */
  getCategoryColor(category) {
    const colors = {
      beta: '#8B2635',      // Dark burgundy
      concept: '#708090'    // Slate gray
    };
    
    return colors[category] || colors.beta;
  }

  /**
   * Get approximate position for table layout in a 5-column grid
   */
  getTablePosition(tableName, category) {
    // Create ordered list of all tables to ensure consistent grid layout
    const allTables = [
      // Beta tables in specific order for better visual flow
      'patient', 'hospitalization', 'adt', 'code_status', 'labs',
      'vitals', 'respiratory_support', 'medication_admin_continuous', 'medication_admin_intermittent', 'medication_orders',
      'microbiology_culture', 'microbiology_nonculture', 'patient_assessments', 'patient_procedures', 'crrt_therapy',
      'ecmo_mcs', 'invasive_hemodynamics', 'position', 'hospital_diagnosis', 'transfusion',
      'therapy_details',
      // Concept tables at the end
      'intake_output', 'key_icu_orders', 'place_based_index', 'provider', 'microbiology_susceptibility'
    ];

    const tableIndex = allTables.indexOf(tableName);
    if (tableIndex === -1) {
      // If table not in our ordered list, use default positioning
      return this.getDefaultPosition(category);
    }

    // 5-column grid layout
    const tablesPerRow = 5;
    const tableWidth = 270;  // Width including spacing (increased for wider tables)
    const tableHeight = 200; // Height including spacing (increased for taller headers)
    const startX = 50;       // Left margin
    const startY = 50;       // Top margin

    const col = tableIndex % tablesPerRow;
    const row = Math.floor(tableIndex / tablesPerRow);

    return {
      x: startX + (col * tableWidth),
      y: startY + (row * tableHeight)
    };
  }

  /**
   * Get default position based on category with better spacing
   */
  getDefaultPosition(category) {
    // Use static counters for each category to space them out
    if (!this.positionCounters) {
      this.positionCounters = { beta: 0, concept: 0 };
    }
    
    const spacing = 250; // Space between tables
    const rowHeight = 150; // Space between rows
    const tablesPerRow = 5;
    
    const counter = this.positionCounters[category]++;
    const col = counter % tablesPerRow;
    const row = Math.floor(counter / tablesPerRow);
    
    const basePositions = {
      beta: { x: 100, y: 200 },    // Beta tables in main area
      concept: { x: 100, y: 600 }  // Concept tables at bottom
    };
    
    const base = basePositions[category] || basePositions.beta;
    
    return {
      x: base.x + (col * spacing),
      y: base.y + (row * rowHeight)
    };
  }

  /**
   * Format table name for display
   */
  formatTableName(tableName) {
    return tableName.replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Format data type for display
   */
  formatDataType(type) {
    if (typeof type === 'object') {
      if (type.dataType) {
        return type.dataType.toUpperCase();
      }
      return 'UNKNOWN';
    }
    
    return type ? type.toUpperCase() : 'VARCHAR';
  }

  /**
   * Extract field comment from JSON comment
   */
  extractFieldComment(fieldSchema) {
    if (fieldSchema.comment) {
      if (typeof fieldSchema.comment === 'object') {
        return fieldSchema.comment.description || '';
      } else {
        try {
          const commentObj = JSON.parse(fieldSchema.comment);
          return commentObj.description || '';
        } catch (e) {
          return fieldSchema.comment;
        }
      }
    }
    return '';
  }

  /**
   * Extract table comments from SQL content
   */
  extractTableComments(tableName, sqlContent) {
    // Look for table-level comments in the SQL
    const tableRegex = new RegExp(`CREATE TABLE ${tableName}[\\s\\S]*?COMMENT\\s*'([^']*)'`, 'i');
    const match = sqlContent.match(tableRegex);
    return match ? match[1] : '';
  }

  /**
   * Extract primary keys
   */
  extractPrimaryKeys(tableSchema) {
    const primaryKeys = [];
    const columns = tableSchema.columns || {};
    
    for (const [fieldName, fieldSchema] of Object.entries(columns)) {
      if (fieldSchema.primaryKey) {
        primaryKeys.push(fieldName);
      }
    }
    
    return primaryKeys;
  }

  /**
   * Extract foreign keys
   */
  extractForeignKeys(tableSchema) {
    const foreignKeys = [];
    const columns = tableSchema.columns || {};
    
    for (const [fieldName, fieldSchema] of Object.entries(columns)) {
      if (fieldSchema.references) {
        foreignKeys.push({
          field: fieldName,
          references: fieldSchema.references
        });
      }
    }
    
    return foreignKeys;
  }

  /**
   * Get category counts for metadata
   */
  getCategoryCounts(tables) {
    const counts = { core: 0, medical: 0, concept: 0 };
    
    tables.forEach(table => {
      counts[table.category] = (counts[table.category] || 0) + 1;
    });
    
    return counts;
  }
}

/**
 * Main function to generate ERD data from SQL file
 */
export async function generateERDData(sqlFilePath) {
  const parser = new ERDParser();
  return await parser.parseDDL(sqlFilePath);
}