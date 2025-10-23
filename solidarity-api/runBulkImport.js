import bulkImportMembers from './src/scripts/bulkImportMembers.js';

console.log('Starting bulk import process...');
console.log('This will DELETE all existing districts, groups, and members!');
console.log('Press Ctrl+C to cancel within 5 seconds...');

setTimeout(() => {
  bulkImportMembers();
}, 5000);