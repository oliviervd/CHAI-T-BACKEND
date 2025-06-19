const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Add connection options
const supabaseOptions = {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: {
            'Content-Type': 'application/json'
        }
    }
};

let supabase;

async function initializeSupabase() {
    try {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
            throw new Error('Missing Supabase credentials in environment variables');
        }

        supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_KEY,
            supabaseOptions
        );

        // Test connection
        const { data, error } = await supabase
            .from('THESAURI')
            .select('count')
            .limit(1)
            .single();

        if (error) {
            throw new Error(`Connection test failed: ${error.message}`);
        }

        console.log('Successfully connected to Supabase');
        return true;

    } catch (error) {
        console.error('Supabase initialization error:', {
            message: error.message,
            code: error?.code,
            details: error?.details
        });
        return false;
    }
}

async function database(data) {
    try {
        // Ensure connection is initialized
        if (!supabase) {
            const initialized = await initializeSupabase();
            if (!initialized) {
                throw new Error('Failed to initialize database connection');
            }
        }

        // Log the incoming data
        console.log('\nProcessing record:', {
            puri: data.puri,
            identifier: data.identifier,
            provenance: data.provenance
        });

        // Input validation
        const requiredFields = ['puri', 'provenance', 'identifier'];
        const missingFields = requiredFields.filter(field => !data[field]);
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Normalize and validate data lengths
        const upsertData = {
            puri: data.puri?.substring(0, 255), // Add appropriate length limits
            provenance: data.provenance?.substring(0, 50),
            identifier: data.identifier?.substring(0, 100),
            label_NL: data.labelNL?.substring(0, 1000) || null,
            label_FR: data.labelFR?.substring(0, 1000) || null,
            label_EN: data.labelEN?.substring(0, 1000) || null,
            scope_NL: data.scopeNL?.substring(0, 2000) || null,
            scope_FR: data.scopeFR?.substring(0, 2000) || null,
            scope_EN: data.scopeEN?.substring(0, 2000) || null,
            modified_at: data.modifiedAt || null,
            AAT: data.aat?.substring(0, 255) || null,
            Wikidata: data.wikidata?.substring(0, 255) || null
        };

        // Try to select existing record with retry
        let retryCount = 0;
        const maxRetries = 3;
        let selectError;

        while (retryCount < maxRetries) {
            try {
                const { data: existing, error } = await supabase
                    .from('THESAURI')
                    .select('puri')
                    .eq('puri', data.puri)
                    .maybeSingle();

                if (!error || error.code === 'PGRST116') {
                    // Success or "not found" error, which is fine
                    break;
                }

                selectError = error;
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            } catch (error) {
                console.error('Select operation error:', error);
                selectError = error;
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }
        }

        if (selectError && retryCount === maxRetries) {
            throw new Error(`Select operation failed after ${maxRetries} retries: ${selectError.message}`);
        }

        // Perform upsert with retry
        retryCount = 0;
        let upsertError;

        while (retryCount < maxRetries) {
            try {
                const { error } = await supabase
                    .from('THESAURI')
                    .upsert(upsertData, {
                        onConflict: 'puri',
                        returning: 'minimal'
                    });

                if (!error) {
                    // Success
                    return {
                        success: true,
                        operation: 'upserted',
                        puri: data.puri
                    };
                }

                upsertError = error;
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            } catch (error) {
                console.error('Upsert operation error:', error);
                upsertError = error;
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }
        }

        throw new Error(`Upsert operation failed after ${maxRetries} retries: ${upsertError?.message || 'Unknown error'}`);

    } catch (error) {
        // Add more context to the error
        const errorContext = {
            message: error.message,
            code: error?.code,
            hint: error?.hint,
            details: error?.details,
            puri: data?.puri,
            stack: error.stack
        };

        console.error('Database operation failed:', errorContext);

        return {
            success: false,
            error: error.message,
            errorDetails: errorContext,
            puri: data?.puri
        };
    }
}

// Export both functions
module.exports = { database, initializeSupabase };