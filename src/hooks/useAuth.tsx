import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: 'student' | 'manager' | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, role: 'student' | 'manager') => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'manager' | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Timeout de segurança: se após 10 segundos ainda estiver loading, forçar false
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('Loading timeout - forcing loading to false');
        setLoading(false);
      }
    }, 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, 'User:', session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('Fetching user role for:', session.user.id);
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          console.log('No session, setting userRole to null');
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const fetchUserRole = async (userId: string, retryCount = 0) => {
    console.log(`Fetching user role for ${userId}, attempt ${retryCount + 1}`);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        // Se for erro de rede e ainda temos retries, tentar novamente
        if (error.message?.includes('Failed to fetch') && retryCount < 3) {
          console.log(`Retrying fetch user role... Attempt ${retryCount + 1}`);
          setTimeout(() => {
            fetchUserRole(userId, retryCount + 1);
          }, Math.pow(2, retryCount) * 1000);
          return;
        }
        // Se esgotou os retries ou é outro tipo de erro, setar null e parar loading
        console.error('Failed to fetch user role after retries');
        setUserRole(null);
        setLoading(false);
        return;
      }
      
      // Se data é null ou não tem role, setar null
      if (!data || !data.role) {
        console.warn('User has no role in user_roles table for userId:', userId);
        setUserRole(null);
      } else {
        console.log('User role fetched successfully:', data.role);
        setUserRole(data.role as 'student' | 'manager');
      }
      setLoading(false);
    } catch (error) {
      console.error('Unexpected error fetching user role:', error);
      setUserRole(null);
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, role: 'student' | 'manager') => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: role,
        },
      },
    });

    if (!error && data.user && role === 'student') {
      await supabase.from('student_journeys').insert({
        student_id: data.user.id,
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
