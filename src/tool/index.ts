// 工具声明：行业答题获客（自定义界面：题库 / 品牌 / 导出 H5 三个页签）
import { Trophy as TrophyAsIcon } from 'lucide-react';
import { createElement } from 'react';
import type { CustomTool } from '../kit/types';
import { Maker } from './Main';

const tool: CustomTool = {
  id: 'w29',
  name: '行业答题获客',
  tagline: '编辑题库、设置品牌，一键导出可放到任何静态空间的手机答题网页：答题升级、段位、经营诊断、错题解析、分享海报、领奖页。',
  icon: TrophyAsIcon,
  category: '微信私域',
  type: 'data',
  mode: 'custom',
  mainLabel: '出题器',
  params: [],
  Main: ({ ctx }) => createElement(Maker, { ctx }),
};

export default tool;
