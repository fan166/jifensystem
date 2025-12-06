import React, { useEffect, useState } from 'react';
import { Modal, Form, Button, Checkbox, message, Descriptions, Tag } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import dayjs from 'dayjs';

interface SimpleCompletionConfirmProps {
  visible: boolean;
  onCancel: () => void;
  keyWork: any;
  onSuccess: () => void;
}

interface LeaderInfo { id: string; name: string };

const SimpleCompletionConfirm: React.FC<SimpleCompletionConfirmProps> = ({ visible, onCancel, keyWork, onSuccess }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [leader, setLeader] = useState<LeaderInfo | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!visible || !keyWork) return;
    (async () => {
      const { data, error } = await supabase
        .from('key_work_participants')
        .select('id, role, users:users(id, name)')
        .eq('key_work_id', keyWork.id)
        .eq('role', 'leader')
        .limit(1)
        .single();
      if (!error && data && (data as any).users) {
        setLeader({ id: (data as any).users.id, name: (data as any).users.name });
      } else {
        setLeader(null);
      }
      form.resetFields();
    })();
  }, [visible, keyWork]);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('key_works')
        .update({
          status: 'completed',
          actual_completion_date: keyWork?.actual_completion_date || dayjs().format('YYYY-MM-DD')
        })
        .eq('id', keyWork.id);
      if (error) throw error;

      if (keyWork?.status !== 'completed') {
        const { data: participants } = await supabase
          .from('key_work_participants')
          .select('user_id, role, individual_score, is_active')
          .eq('key_work_id', keyWork.id)
          .eq('is_active', true);

        const { data: type } = await supabase
          .from('score_types')
          .select('id, category')
          .eq('category', 'key_work')
          .limit(1)
          .single();

        const period = dayjs().format('YYYY-MM');
        const records = (participants || [])
          .filter(p => typeof p.individual_score === 'number' && p.individual_score > 0)
          .map(p => ({
            user_id: (p as any).user_id,
            score_type_id: (type as any)?.id,
            score: (p as any).individual_score,
            reason: `重点工作：${keyWork?.work_title || ''}`,
            recorder_id: user?.id || null,
            period
          }));

        if (records.length > 0 && (type as any)?.id) {
          await supabase.from('scores').insert(records);
        }
      }
      message.success('完成情况已确认');
      form.resetFields();
      onSuccess();
      onCancel();
    } catch (e) {
      message.error('确认失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="完成情况确认" open={visible} onCancel={onCancel} footer={null} width={560}>
      <div className="space-y-4">
        <div className="text-center">
          <CheckCircleOutlined className="text-5xl text-green-500" />
          <div className="mt-2 text-lg font-medium">完成情况确认</div>
        </div>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="工作标题">{keyWork?.work_title}</Descriptions.Item>
          <Descriptions.Item label="负责人">{leader?.name || '未指定'}</Descriptions.Item>
          <Descriptions.Item label="完成率">{keyWork?.completion_rate ?? 0}%</Descriptions.Item>
          <Descriptions.Item label="实际完成日期">{keyWork?.actual_completion_date || dayjs().format('YYYY-MM-DD')}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={keyWork?.status === 'completed' ? 'success' : 'processing'}>
              {keyWork?.status === 'completed' ? '已完成' : '进行中'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
        <Form form={form} layout="vertical" onFinish={handleConfirm}>
          <Form.Item name="confirmed" valuePropName="checked" rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject(new Error('请勾选确认')) }]}>
            <Checkbox>我确认上述完成情况属实</Checkbox>
          </Form.Item>
          <div className="flex justify-end space-x-2">
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>确认</Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};

export default SimpleCompletionConfirm;
