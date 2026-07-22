import { createClient } from '@supabase/supabase-js';

// 1. Pega tu Project URL de Supabase aquí (entre comillas y sin /rest/v1/)
const supabaseUrl = 'https://exrrcqwfiapfdcwjxzbf.supabase.co';

// 2. Pega tu Project API Key (anon / public) aquí (entre comillas)
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4cnJjcXdmaWFwZmRjd2p4emJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTE4NzEsImV4cCI6MjEwMDI2Nzg3MX0.EVdanFrVIjHf5ZCY0_XNCPWIYQrYsGR-hgRtC7OxUWE';

// 3. Creamos y exportamos la conexión para usarla en toda la app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);