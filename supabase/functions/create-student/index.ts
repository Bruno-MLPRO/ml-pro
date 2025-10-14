import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateStudentRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  turma?: string;
  estado?: string;
  estrutura_vendedor?: string;
  tipo_pj?: string;
  cnpj?: string;
  possui_contador?: boolean;
  caixa?: number;
  hub_logistico?: string;
  sistemas_externos?: string;
  mentoria_status?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Não autorizado - Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authorization header present, validating user...');

    // Create Supabase client with user's token to check their role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the requesting user is a manager
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('Error getting user:', userError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Não autorizado - Falha na autenticação' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Check if user has manager role
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'manager')
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('User is not a manager:', roleError?.message || 'No manager role found');
      return new Response(
        JSON.stringify({ error: 'Apenas gestores podem criar alunos' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Manager role verified for user:', user.id);

    // Parse request body
    const body = await req.json() as CreateStudentRequest;
    console.log('Creating student with email:', body.email, 'estrutura_vendedor:', body.estrutura_vendedor);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password
    if (!body.password || body.password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter pelo menos 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase Admin client for user creation
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Create the user via Admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        role: 'student'
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      
      // Handle specific error messages
      if (createError.message.includes('already registered')) {
        return new Response(
          JSON.stringify({ error: 'Este email já está cadastrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newUser.user) {
      console.error('No user returned from creation');
      return new Response(
        JSON.stringify({ error: 'Erro ao criar usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User created successfully:', newUser.user.id);

    // Validate tipo_pj logic before updating profile
    const profileData: any = {
      phone: body.phone,
      turma: body.turma,
      estado: body.estado,
      estrutura_vendedor: body.estrutura_vendedor,
      possui_contador: body.possui_contador,
      caixa: body.caixa,
      hub_logistico: body.hub_logistico,
      sistemas_externos: body.sistemas_externos,
      mentoria_status: body.mentoria_status || 'Ativo',
    };

    // Only include tipo_pj and cnpj if estrutura_vendedor is 'PJ'
    if (body.estrutura_vendedor === 'PJ') {
      if (!body.tipo_pj) {
        return new Response(
          JSON.stringify({ error: 'Tipo de PJ é obrigatório quando estrutura é PJ' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      profileData.tipo_pj = body.tipo_pj;
      profileData.cnpj = body.cnpj;
    } else {
      // Ensure tipo_pj and cnpj are null for CPF
      profileData.tipo_pj = null;
      profileData.cnpj = null;
    }

    console.log('Updating profile with data:', JSON.stringify(profileData, null, 2));

    // Update the profile with additional data
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileData)
      .eq('id', newUser.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return new Response(
        JSON.stringify({ error: `Erro ao atualizar perfil: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Student created successfully with ID:', newUser.user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
