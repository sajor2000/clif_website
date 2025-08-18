import { generateERDData } from '../src/utils/erdParser.js';
import fs from 'fs';
import path from 'path';

/**
 * Build-time script to generate ERD data and update related files
 */
async function generateERD() {
  console.log('🔄 Generating ERD data from SQL DDL...');
  
  try {
    const sqlFilePath = path.resolve('./src/content/v-2-1-0-ddl.sql');
    const erdData = await generateERDData(sqlFilePath);
    
    // Save ERD data as JSON for potential caching/debugging
    const outputPath = path.resolve('./public/data/erd-data.json');
    
    // Ensure directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write ERD data
    fs.writeFileSync(outputPath, JSON.stringify(erdData, null, 2));
    
    console.log('✅ ERD data generated successfully');
    console.log(`📊 Found ${erdData.tables.length} tables:`);
    console.log(`   - Core: ${erdData.metadata.categories.core}`);
    console.log(`   - Medical: ${erdData.metadata.categories.medical}`);
    console.log(`   - Concept: ${erdData.metadata.categories.concept}`);
    console.log(`🔗 Found ${erdData.relationships.length} relationships`);
    
    // Check for any issues
    const tablesWithoutRelationships = erdData.tables.filter(table => 
      !erdData.relationships.some(rel => rel.from === table.name || rel.to === table.name)
    );
    
    if (tablesWithoutRelationships.length > 0) {
      console.log('⚠️  Tables without relationships:');
      tablesWithoutRelationships.forEach(table => {
        console.log(`   - ${table.name}`);
      });
    }
    
    return erdData;
    
  } catch (error) {
    console.error('❌ Error generating ERD:', error);
    throw error;
  }
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  generateERD()
    .then(() => {
      console.log('🎉 ERD generation complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 ERD generation failed:', error);
      process.exit(1);
    });
}

export { generateERD };