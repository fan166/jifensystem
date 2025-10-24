import { supabase } from '../lib/supabase';
import type { User, Department, ScoreType, Score, Evaluation, Reward } from '../lib/supabase';

// 用户相关API
export const userAPI = {
  // 获取所有用户
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        department:departments(name)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // 创建用户
  async createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert([user])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 更新用户
  async updateUser(id: string, user: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update({ ...user, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 删除用户
  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // 根据邮箱获取用户
  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }
};

// 部门相关API
export const departmentAPI = {
  // 获取所有部门
  async getDepartments(): Promise<Department[]> {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  },

  // 创建部门
  async createDepartment(department: Omit<Department, 'id' | 'created_at'>): Promise<Department> {
    const { data, error } = await supabase
      .from('departments')
      .insert([department])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 更新部门
  async updateDepartment(id: string, department: Partial<Department>): Promise<Department> {
    const { data, error } = await supabase
      .from('departments')
      .update(department)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 删除部门
  async deleteDepartment(id: string): Promise<void> {
    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// 积分类型相关API
export const scoreTypeAPI = {
  // 获取所有积分类型
  async getScoreTypes(): Promise<ScoreType[]> {
    const { data, error } = await supabase
      .from('score_types')
      .select('*')
      .order('category', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  // 根据分类获取积分类型
  async getScoreTypesByCategory(category: string): Promise<ScoreType[]> {
    const { data, error } = await supabase
      .from('score_types')
      .select('*')
      .eq('category', category)
      .order('name');
    
    if (error) throw error;
    return data || [];
  }
};

// 积分记录相关API
export const scoreAPI = {
  // 获取积分记录
  async getScores(filters?: {
    userId?: string;
    scoreTypeId?: string;
    period?: string;
    category?: string;
  }): Promise<Score[]> {
    let query = supabase
      .from('scores')
      .select(`
        *,
        user:users!scores_user_id_fkey(name, email),
        score_type:score_types(name, category),
        recorder:users!scores_recorder_id_fkey(name)
      `)
      .order('created_at', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.scoreTypeId) {
      query = query.eq('score_type_id', filters.scoreTypeId);
    }
    if (filters?.period) {
      query = query.eq('period', filters.period);
    }
    if (filters?.category) {
      query = query.eq('score_types.category', filters.category);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  // 创建积分记录
  async createScore(score: Omit<Score, 'id' | 'created_at' | 'updated_at'>): Promise<Score> {
    const { data, error } = await supabase
      .from('scores')
      .insert([score])
      .select(`
        *,
        user:users!scores_user_id_fkey(name, email),
        score_type:score_types(name, category),
        recorder:users!scores_recorder_id_fkey(name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  // 更新积分记录
  async updateScore(id: string, score: Partial<Score>): Promise<Score> {
    const { data, error } = await supabase
      .from('scores')
      .update({ ...score, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        user:users!scores_user_id_fkey(name, email),
        score_type:score_types(name, category),
        recorder:users!scores_recorder_id_fkey(name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  // 删除积分记录
  async deleteScore(id: string): Promise<void> {
    const { error } = await supabase
      .from('scores')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // 获取用户积分统计
  async getUserScoreStats(userId: string, period?: string) {
    const currentPeriod = period || new Date().toISOString().slice(0, 7);
    
    const { data, error } = await supabase
      .from('scores')
      .select(`
        score,
        scoreType:score_types(category)
      `)
      .eq('user_id', userId)
      .eq('period', currentPeriod);

    if (error) throw error;

    const stats = {
      totalScore: 0,
      basicDuty: 0,
      workPerformance: 0,
      keyWork: 0,
      bonus: 0
    };

    data?.forEach((record: any) => {
      const score = record.score || 0;
      stats.totalScore += score;
      
      const category = record.scoreType?.category;
      if (category) {
        switch (category) {
          case 'basic_duty':
            stats.basicDuty += score;
            break;
          case 'work_performance':
            stats.workPerformance += score;
            break;
          case 'key_work':
            stats.keyWork += score;
            break;
          case 'performance_bonus':
            stats.bonus += score;
            break;
        }
      }
    });

    return stats;
  },

  // 获取积分排名
  async getScoreRanking(period?: string) {
    const currentPeriod = period || new Date().toISOString().slice(0, 7);
    
    const { data, error } = await supabase
      .from('scores')
      .select(`
        user_id,
        score,
        user:users!scores_user_id_fkey(id, name, email, department:departments(name))
      `)
      .eq('period', currentPeriod);

    if (error) throw error;

    // 按用户聚合积分
    const userScores = new Map();
    data?.forEach(record => {
      const userId = record.user_id;
      const score = record.score || 0;
      
      if (userScores.has(userId)) {
        userScores.get(userId).totalScore += score;
      } else {
        userScores.set(userId, {
          userId,
          user: record.user,
          totalScore: score
        });
      }
    });

    // 转换为数组并排序
    const ranking = Array.from(userScores.values())
      .sort((a, b) => b.totalScore - a.totalScore);

    return ranking;
  }
};

// 考核相关API
export const evaluationAPI = {
  // 获取考核记录
  async getEvaluations(filters?: {
    userId?: string;
    evaluatorId?: string;
    period?: string;
    status?: string;
  }): Promise<Evaluation[]> {
    let query = supabase
      .from('evaluations')
      .select(`
        *,
        user:users!evaluations_user_id_fkey(name, email),
        evaluator:users!evaluations_evaluator_id_fkey(name)
      `)
      .order('created_at', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.evaluatorId) {
      query = query.eq('evaluator_id', filters.evaluatorId);
    }
    if (filters?.period) {
      query = query.eq('period', filters.period);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  // 创建考核记录
  async createEvaluation(evaluation: Omit<Evaluation, 'id' | 'created_at' | 'updated_at'>): Promise<Evaluation> {
    const { data, error } = await supabase
      .from('evaluations')
      .insert([evaluation])
      .select(`
        *,
        user:users!evaluations_user_id_fkey(name, email),
        evaluator:users!evaluations_evaluator_id_fkey(name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  // 更新考核记录
  async updateEvaluation(id: string, evaluation: Partial<Evaluation>): Promise<Evaluation> {
    const { data, error } = await supabase
      .from('evaluations')
      .update({ ...evaluation, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        user:users!evaluations_user_id_fkey(name, email),
        evaluator:users!evaluations_evaluator_id_fkey(name)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  // 删除考核记录
  async deleteEvaluation(id: string): Promise<void> {
    const { error } = await supabase
      .from('evaluations')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// 奖励相关API
export const rewardAPI = {
  // 获取奖励记录
  async getRewards(filters?: {
    userId?: string;
    type?: string;
    period?: string;
  }): Promise<Reward[]> {
    let query = supabase
      .from('rewards')
      .select(`
        *,
        user:users!rewards_user_id_fkey(name, email)
      `)
      .order('created_at', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.period) {
      query = query.eq('period', filters.period);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  // 创建奖励记录
  async createReward(reward: Omit<Reward, 'id' | 'created_at' | 'updated_at'>): Promise<Reward> {
    const { data, error } = await supabase
      .from('rewards')
      .insert([reward])
      .select(`
        *,
        user:users!rewards_user_id_fkey(name, email)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  // 更新奖励记录
  async updateReward(id: string, reward: Partial<Reward>): Promise<Reward> {
    const { data, error } = await supabase
      .from('rewards')
      .update({ ...reward, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        user:users!rewards_user_id_fkey(name, email)
      `)
      .single();
    
    if (error) throw error;
    return data;
  },

  // 删除奖励记录
  async deleteReward(id: string): Promise<void> {
    const { error } = await supabase
      .from('rewards')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};