import React, { useState, useRef } from 'react';
import FireflyEngine from './components/FireflyEngine';
import { FireflyConfig } from './types';

const App: React.FC = () => {
  const [config, setConfig] = useState<FireflyConfig>({
    count: 35,
    color: '#ffff00',
    speed: 1.2,
    flickerRate: 5,
    wingSpeed: 8,
  });

  // 使用 targetText 存储选中的图形 ID
  const [targetText, setTargetText] = useState('');
  const [isGathering, setIsGathering] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // 用于处理延时汇聚的 ref
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SHAPE_BUTTONS = [
      { id: 'heart', label: '爱心', icon: 'fa-solid fa-heart' },
      { id: 'arrow_heart', label: '一箭穿心', icon: 'fa-solid fa-heart-pulse' }, 
  ];

  const handleShapeSelect = (shapeId: string) => {
    // 清除之前的延时任务（如果有）
    if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
    }

    // 如果是特殊的 'scatter' 动作
    if (shapeId === 'scatter') {
        setIsGathering(false);
        setTargetText('');
        return;
    }

    if (isGathering) {
        if (targetText === shapeId) {
            // 点击已选中的：直接散开
            setIsGathering(false);
            setTargetText(''); // 清空目标，取消高亮
        } else {
            // 点击不同的：先散开，再汇聚
            setIsGathering(false);
            // 立即更新 targetText 以便 UI 高亮显示用户的选择，但因为 isGathering 为 false，引擎会执行散开逻辑
            setTargetText(shapeId);
            
            // 延迟 1.5 秒后开始汇聚
            transitionTimeoutRef.current = setTimeout(() => {
                setIsGathering(true);
                transitionTimeoutRef.current = null;
            }, 1500);
        }
    } else {
        // 当前未汇聚：直接汇聚
        setTargetText(shapeId);
        setIsGathering(true);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden text-white font-sans bg-black">
      {/* 核心引擎 */}
      <FireflyEngine config={config} targetText={targetText} isGathering={isGathering} />

      {/* 右侧控制区 */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-end gap-4">
        
        {/* 菜单开关按钮 */}
        <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-12 h-12 rounded-full backdrop-blur-md border border-white/20 shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-white/10 ${isMenuOpen ? 'bg-white/20 text-yellow-300' : 'bg-black/30 text-white/70'}`}
        >
            <i className={`fa-solid ${isMenuOpen ? 'fa-xmark' : 'fa-wand-magic-sparkles'} text-xl`}></i>
        </button>

        {/* 竖排图形选择列表 - 根据 isMenuOpen 显示/隐藏 */}
        <div className={`flex flex-col gap-3 transition-all duration-500 origin-right ${isMenuOpen ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-10 scale-90 pointer-events-none'}`}>
            <div className="flex flex-col gap-3 p-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                {SHAPE_BUTTONS.map((shape) => {
                    const isSelected = targetText === shape.id;
                    // 如果选中了，但还没开始 gathering (正在 timeout)，认为是 waiting
                    const isWaiting = isSelected && !isGathering && transitionTimeoutRef.current !== null;
                    // 如果选中了且 gathering，就是 active
                    const isActive = isSelected && isGathering;

                    return (
                        <button
                            key={shape.id}
                            onClick={() => handleShapeSelect(shape.id)}
                            className={`group relative flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-300 ${
                                isSelected
                                ? 'bg-yellow-500/20 text-yellow-200 shadow-[0_0_15px_rgba(253,224,71,0.3)]' 
                                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white hover:scale-105'
                            }`}
                        >
                            <i className={`${shape.icon} text-lg mb-1 transition-transform duration-300 ${isSelected ? 'scale-110' : ''}`}></i>
                            <span className="text-[9px] tracking-widest opacity-80 scale-90">{shape.label}</span>
                            
                            {/* 激活时的光效 */}
                            {isActive && (
                                <span className="absolute inset-0 rounded-xl ring-1 ring-yellow-500/50 animate-pulse"></span>
                            )}
                             {/* 等待时的光效 (呼吸灯快一点) */}
                             {isWaiting && (
                                <span className="absolute inset-0 rounded-xl ring-1 ring-white/50 animate-ping opacity-30"></span>
                            )}
                        </button>
                    );
                })}

                {/* 分隔线 */}
                <div className="h-px bg-white/10 my-1"></div>

                {/* 散开按钮 */}
                <button
                    onClick={() => handleShapeSelect('scatter')}
                    className="group relative flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-300 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white hover:scale-105"
                >
                    <i className="fa-solid fa-wind text-lg mb-1 transition-transform duration-300 group-hover:scale-110"></i>
                    <span className="text-[9px] tracking-widest opacity-80 scale-90">散开</span>
                </button>
            </div>
        </div>
      </div>

      {/* 状态提示文案 (可选，仅在 active 时显示) */}
      {isGathering && targetText && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-1000">
            <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] animate-pulse shadow-black drop-shadow-md">
                {SHAPE_BUTTONS.find(s => s.id === targetText)?.label}
            </p>
          </div>
      )}

      {/* 氛围特效 */}
      <div className="fixed inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.8)] opacity-60"></div>
    </div>
  );
};

export default App;