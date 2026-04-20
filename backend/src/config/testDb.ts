import { supabase } from './supabase';

async function testConnection() {
  const { data, error } = await supabase
    .from('trusted_sources')
    .select('name, domain')
    .limit(5);

  if (error) {
    console.error('❌ Supabase connection failed:', error.message);
  } else {
    console.log('✅ Supabase connected! Sample sources:');
    console.table(data);
  }
}

testConnection();
