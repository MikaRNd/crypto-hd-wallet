import { supabase, getServiceRoleClient } from '@/integrations/supabase/client';

// Types for the deposit_addresses table
export interface DepositAddress {
  id: string;
  user_id: string;
  wallet_address: string;
  created_at: string;
}

export const database = {
  // Deposit address operations
  async createDepositAddress(userId: string, walletAddress: string): Promise<DepositAddress> {
    const { data, error } = await getServiceRoleClient()
      .from('deposit_addresses')
      .insert({ 
        user_id: userId, 
        wallet_address: walletAddress.toLowerCase() 
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as DepositAddress;
  },

  async getDepositAddressesByUserId(userId: string): Promise<DepositAddress[]> {
    const { data, error } = await supabase
      .from('deposit_addresses')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data as DepositAddress[];
  },

  async getDepositAddressByAddress(walletAddress: string): Promise<DepositAddress | null> {
    const { data, error } = await supabase
      .from('deposit_addresses')
      .select('*')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data as DepositAddress | null;
  },

  async getDepositAddressById(id: string): Promise<DepositAddress | null> {
    const { data, error } = await supabase
      .from('deposit_addresses')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as DepositAddress | null;
  },

  async updateDepositAddress(id: string, updates: Partial<Omit<DepositAddress, 'id' | 'created_at'>>): Promise<DepositAddress> {
    const { data, error } = await getServiceRoleClient()
      .from('deposit_addresses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as DepositAddress;
  },

  async deleteDepositAddress(id: string): Promise<void> {
    const { error } = await getServiceRoleClient()
      .from('deposit_addresses')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

export default database;
