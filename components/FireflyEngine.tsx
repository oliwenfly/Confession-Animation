import React, { useEffect, useRef } from 'react';
import { FireflyConfig, Star, Point } from '../types';

interface FireflyEngineProps {
  config: FireflyConfig;
  targetText: string;
  isGathering: boolean;
}

const FireflyEngine: React.FC<FireflyEngineProps> = ({ config, targetText, isGathering }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const firefliesRef = useRef<Firefly[]>([]);
  const frameId = useRef<number>(0);
  const targetPointsRef = useRef<Point[]>([]);
  
  // 记录汇聚开始的绝对时间戳
  const gatherStartTimeRef = useRef<number>(0);

  const BEAUTIFUL_COLORS = [
    '#ffff33', '#ccff00', '#00ffff', '#ffaa00', '#00ffcc', '#ff66cc', '#ffffff',
  ];

  // --- 新增：图形生成算法 ---
  const getShapePoints = (shapeType: string, width: number, height: number): Point[] => {
    const points: Point[] = [];
    const cx = width / 2;
    const cy = height / 2;
    // 基础缩放，适配屏幕
    const scale = Math.min(width, height) * 0.35; 
    // 降低点数以减少密集度，从 2500 降至 500
    const numPoints = 500; 

    for (let i = 0; i < numPoints; i++) {
      // 归一化参数 t: 0 -> 2*PI
      const t = (i / numPoints) * Math.PI * 2;
      let x = 0;
      let y = 0;
      
      // 添加一些随机抖动，让图形看起来更有机，不那么生硬
      const jitter = 0.02; 
      const jt = t + (Math.random() - 0.5) * jitter;

      switch (shapeType) {
        case 'heart': // 爱心
          // x = 16sin^3(t)
          // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
          x = 16 * Math.pow(Math.sin(jt), 3);
          y = -(13 * Math.cos(jt) - 5 * Math.cos(2 * jt) - 2 * Math.cos(3 * jt) - Math.cos(4 * jt));
          // 爱心需要特殊的缩放，因为它原本的坐标范围比较大
          x *= (scale / 16);
          y *= (scale / 16);
          break;

        case 'arrow_heart': // 一箭穿心
          const heartRatio = 0.65; // 65% 点组成心，35% 组成箭
          const heartCount = Math.floor(numPoints * heartRatio);
          
          if (i < heartCount) {
             // 绘制心形
             const th = (i / heartCount) * Math.PI * 2;
             x = 16 * Math.pow(Math.sin(th), 3);
             y = -(13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th));
             x *= (scale / 16);
             y *= (scale / 16);
          } else {
             // 绘制箭
             const arrowIndex = i - heartCount;
             const arrowTotal = numPoints - heartCount;
             const tArrow = arrowIndex / arrowTotal;
             
             // 箭参数：左上到右下
             const angle = Math.PI / 4 + 0.1; 
             const len = scale * 2.8;
             const startX = -Math.cos(angle) * len * 0.5 - scale * 0.3;
             const startY = -Math.sin(angle) * len * 0.5 - scale * 0.3;
             const endX = Math.cos(angle) * len * 0.5 - scale * 0.3;
             const endY = Math.sin(angle) * len * 0.5 - scale * 0.3;

             if (tArrow < 0.7) {
                 // 箭杆
                 const tLine = tArrow / 0.7;
                 x = startX + (endX - startX) * tLine;
                 y = startY + (endY - startY) * tLine;
                 x += (Math.random() - 0.5) * 2;
                 y += (Math.random() - 0.5) * 2;
             } else if (tArrow < 0.85) {
                 // 箭头
                 const tHead = (tArrow - 0.7) / 0.15;
                 const headSize = scale * 0.4;
                 const side = tHead < 0.5 ? 1 : -1;
                 const localT = tHead < 0.5 ? tHead * 2 : (tHead - 0.5) * 2;
                 const hAngle = angle + Math.PI * 0.85 * side;
                 
                 x = endX + Math.cos(hAngle) * headSize * localT;
                 y = endY + Math.sin(hAngle) * headSize * localT;
             } else {
                 // 箭尾
                 const tTail = (tArrow - 0.85) / 0.15;
                 const tailSize = scale * 0.35;
                 const featherGroup = Math.floor(tTail * 4); 
                 const featherBaseX = startX + Math.cos(angle) * (featherGroup * tailSize * 0.2);
                 const featherBaseY = startY + Math.sin(angle) * (featherGroup * tailSize * 0.2);
                 const side = Math.random() > 0.5 ? 1 : -1;
                 const fAngle = angle + Math.PI * 0.7 * side;
                 const dist = tailSize * 0.4 * Math.random();
                 x = featherBaseX + Math.cos(fAngle) * dist;
                 y = featherBaseY + Math.sin(fAngle) * dist;
             }
          }
          break;

        default:
          return [];
      }

      points.push({ x: cx + x, y: cy + y });
    }
    
    // 随机打乱点的顺序，让汇聚过程更均匀
    for (let j = points.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [points[j], points[k]] = [points[k], points[j]];
    }
    
    return points;
  };


  class Firefly {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    wingAngle: number;
    flicker: number;
    targetAngle: number;
    individualColor: string;
    targetPos: Point | null = null;
    isDocked: boolean = false;
    shouldRemove: boolean = false; // 新增：标记是否应该移除
    
    // 个体差异属性
    speedFactor: number = 0.4 + Math.random() * 0.6; 
    noiseOffset: number = Math.random() * 1000;
    
    // 自然汇聚属性
    gatherDelay: number; 
    cruiseSpeed: number; 

    constructor(w: number, h: number, fromEdge: boolean = false) {
      if (fromEdge) {
        const side = Math.floor(Math.random() * 4);
        const buffer = 150;
        if (side === 0) { this.x = -buffer; this.y = Math.random() * h; }
        else if (side === 1) { this.x = w + buffer; this.y = Math.random() * h; }
        else if (side === 2) { this.x = Math.random() * w; this.y = -buffer; }
        else { this.x = Math.random() * w; this.y = h + buffer; }
      } else {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
      }
      
      this.vx = (Math.random() - 0.5) * 2;
      this.vy = (Math.random() - 0.5) * 2;
      this.angle = Math.atan2(this.vy, this.vx);
      this.targetAngle = this.angle;
      this.wingAngle = Math.random() * Math.PI * 2;
      this.flicker = Math.random() * Math.PI * 2;
      this.individualColor = BEAUTIFUL_COLORS[Math.floor(Math.random() * BEAUTIFUL_COLORS.length)];
      
      this.gatherDelay = Math.random() * 3000;
      this.cruiseSpeed = 2 + Math.random() * 3;
    }

    update(w: number, h: number, cfg: FireflyConfig, gathering: boolean, time: number, gatherElapsed: number) {
      // 翅膀和闪烁始终更新
      this.wingAngle += 0.2 * cfg.wingSpeed;
      this.flicker += 0.06 * cfg.flickerRate;

      // 如果标记为移除，不再参与汇聚逻辑，直接执行飞离逻辑
      if (this.shouldRemove) {
        this.wander(w, h, cfg, time);
        return;
      }

      if (gathering && this.targetPos) {
        if (this.isDocked) {
          // 悬停参数改为平滑的小范围飞行
          const flightRadius = 10.0; // 飞行范围半径
          const flightSpeed = 0.002; // 飞行循环速度

          // 使用复合正弦波生成有机轨迹
          const offsetX = Math.sin(time * flightSpeed + this.noiseOffset) * flightRadius + 
                          Math.sin(time * flightSpeed * 2.1 + this.noiseOffset) * (flightRadius * 0.4);
                     
          const offsetY = Math.cos(time * flightSpeed * 0.87 + this.noiseOffset) * flightRadius + 
                          Math.cos(time * flightSpeed * 1.73 + this.noiseOffset) * (flightRadius * 0.4);

          this.x = this.targetPos.x + offsetX;
          this.y = this.targetPos.y + offsetY;
          
          // --- 随机改变朝向逻辑 ---
          // 2% 的概率选择一个新的随机方向
          if (Math.random() < 0.02) {
            this.targetAngle = Math.random() * Math.PI * 2;
          }

          // 平滑旋转到目标角度
          let angleDiff = this.targetAngle - this.angle;
          // 角度归一化 (-PI 到 PI)
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          
          this.angle += angleDiff * 0.05; // 旋转速度

        } else {
          if (gatherElapsed > this.gatherDelay) {
            const dx = this.targetPos.x - this.x;
            const dy = this.targetPos.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 10.0) { // 稍微放宽停靠判定距离
              this.isDocked = true;
              // 进入停靠状态时，初始化一个随机目标角度，防止突变
              this.targetAngle = this.angle;
            } else {
              const desiredAngle = Math.atan2(dy, dx);
              const wobble = Math.sin(time * 0.003 + this.noiseOffset) * 1.5;
              const approachAngle = desiredAngle + wobble * Math.min(1, dist / 300);
              const approachSpeed = Math.min(this.cruiseSpeed, dist * 0.05 + 0.5);
              
              const targetVx = Math.cos(approachAngle) * approachSpeed;
              const targetVy = Math.sin(approachAngle) * approachSpeed;

              this.vx += (targetVx - this.vx) * 0.04;
              this.vy += (targetVy - this.vy) * 0.04;

              this.x += this.vx;
              this.y += this.vy;
              this.angle = Math.atan2(this.vy, this.vx);
            }
          } else {
            this.wander(w, h, cfg, time);
          }
        }
      } else {
        this.isDocked = false;
        this.wander(w, h, cfg, time);
      }
    }

    wander(w: number, h: number, cfg: FireflyConfig, time: number) {
        if (Math.random() < 0.01) {
          this.targetAngle += (Math.random() - 0.5) * 1.5;
        }
        const angleDiff = this.targetAngle - this.angle;
        this.angle += angleDiff * 0.02;
        
        const speed = cfg.speed * this.speedFactor;
        const wave = Math.sin(time * 0.01 + this.noiseOffset) * 0.5;
        
        // 基础移动
        this.vx = Math.cos(this.angle + wave) * speed;
        this.vy = Math.sin(this.angle + wave) * speed;

        if (this.shouldRemove) {
          // 飞离逻辑：施加离心力，帮助它们飞出屏幕
          const cx = w / 2;
          const cy = h / 2;
          const dx = this.x - cx;
          const dy = this.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 1) {
            // 离中心越远，越往外推
            this.vx += (dx / dist) * 0.5 * speed;
            this.vy += (dy / dist) * 0.5 * speed;
          }
          
          this.x += this.vx;
          this.y += this.vy;
          
          // 对于要移除的萤火虫，不进行边界检查（让它们飞出去）
        } else {
          // 正常逻辑：屏幕边缘循环
          this.x += this.vx;
          this.y += this.vy;

          const buffer = 100;
          if (this.x < -buffer) this.x = w + buffer;
          if (this.x > w + buffer) this.x = -buffer;
          if (this.y < -buffer) this.y = h + buffer;
          if (this.y > h + buffer) this.y = -buffer;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
      ctx.save();
      ctx.translate(this.x, this.y);
      // 始终使用 this.angle，让 update 中的随机朝向逻辑生效
      ctx.rotate(this.angle + Math.PI / 2);

      const flickerVal = (Math.sin(this.flicker) + 1) / 2;
      const color = this.individualColor;
      
      ctx.globalCompositeOperation = 'screen';
      const outerGlowSize = 9 + flickerVal * 18;
      const gradient = ctx.createRadialGradient(0, 4.5, 0, 0, 4.5, outerGlowSize);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.5, color + '11');
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 4.5, outerGlowSize, 0, Math.PI * 2);
      ctx.fill();

      // 中心点
      ctx.beginPath();
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.6 + flickerVal * 0.4;
      ctx.arc(0, 4.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      
      // 身体
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.ellipse(0, 0, 1.8, 3.75, 0, 0, Math.PI * 2);
      ctx.fill();

      // 翅膀
      const wingSpread = Math.sin(this.wingAngle) * 0.8;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.save();
      ctx.rotate(-wingSpread - 0.3);
      ctx.beginPath(); ctx.ellipse(-2.25, -0.75, 4.2, 0.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.rotate(wingSpread + 0.3);
      ctx.beginPath(); ctx.ellipse(2.25, -0.75, 4.2, 0.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      ctx.restore();
    }
  }

  const initStars = (width: number, height: number) => {
    const stars: Star[] = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.2,
        opacity: Math.random(),
        twinkleSpeed: 0.005 + Math.random() * 0.01,
      });
    }
    starsRef.current = stars;
  };

  // 监听汇聚状态变化，重置计时器
  useEffect(() => {
    if (isGathering) {
      gatherStartTimeRef.current = Date.now();
    }
  }, [isGathering]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars(canvas.width, canvas.height);
      if (isGathering && targetText) {
        const validShapes = ['heart', 'arrow_heart'];
        if (validShapes.includes(targetText)) {
          targetPointsRef.current = getShapePoints(targetText, canvas.width, canvas.height);
        } else {
           targetPointsRef.current = [];
        }
        syncFireflies(targetPointsRef.current.length);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    const initialFflies = [];
    for (let i = 0; i < Math.min(config.count, 150); i++) {
      initialFflies.push(new Firefly(canvas.width, canvas.height));
    }
    firefliesRef.current = initialFflies;

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const syncFireflies = (requiredCount: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const current = firefliesRef.current;
    if (requiredCount > current.length) {
      for (let i = 0; i < requiredCount - current.length; i++) {
        current.push(new Firefly(canvas.width, canvas.height, true));
      }
    } else if (requiredCount < current.length) {
      firefliesRef.current = current.slice(0, requiredCount);
    }

    const points = targetPointsRef.current;
    firefliesRef.current.forEach((f, i) => {
      f.targetPos = points[i];
      f.isDocked = false; 
      f.shouldRemove = false;
      f.gatherDelay = Math.random() * 5000;
    });
  };

  useEffect(() => {
    if (isGathering && targetText && canvasRef.current) {
      const validShapes = ['heart', 'arrow_heart'];
      if (validShapes.includes(targetText)) {
        targetPointsRef.current = getShapePoints(targetText, canvasRef.current.width, canvasRef.current.height);
      } else {
        targetPointsRef.current = [];
      }
      syncFireflies(targetPointsRef.current.length);
      firefliesRef.current.forEach(f => f.shouldRemove = false);
    } else {
      // 散开模式
      firefliesRef.current.forEach((f, index) => {
        f.targetPos = null;
        f.isDocked = false;
        if (index >= config.count) {
          f.shouldRemove = true;
        } else {
          f.shouldRemove = false;
        }
      });
    }
  }, [isGathering, targetText]);

  useEffect(() => {
    if (isGathering) return;
    const current = firefliesRef.current;
    if (config.count > current.length) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      for (let i = 0; i < config.count - current.length; i++) {
        const f = new Firefly(canvas.width, canvas.height);
        f.shouldRemove = false;
        current.push(f);
      }
    } else if (config.count < current.length) {
      current.forEach((f, i) => {
        if (i >= config.count) {
          f.shouldRemove = true;
        }
      });
    }
  }, [config.count, isGathering]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); 
    if (!ctx) return;

    let startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const currentTime = now - startTime;
      const gatherElapsed = isGathering ? now - gatherStartTimeRef.current : 0;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      starsRef.current.forEach(star => {
        star.opacity += star.twinkleSpeed;
        if (star.opacity > 1 || star.opacity < 0.1) star.twinkleSpeed *= -1;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, star.opacity)})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 更新并绘制所有萤火虫
      firefliesRef.current.forEach(f => {
        f.update(canvas.width, canvas.height, config, isGathering, currentTime, gatherElapsed);
        f.draw(ctx);
      });

      // 清理步骤
      const cleanupBuffer = 200;
      firefliesRef.current = firefliesRef.current.filter(f => {
        if (!f.shouldRemove) return true;
        
        const isOffScreen = 
          f.x < -cleanupBuffer || 
          f.x > canvas.width + cleanupBuffer || 
          f.y < -cleanupBuffer || 
          f.y > canvas.height + cleanupBuffer;
          
        return !isOffScreen;
      });

      frameId.current = requestAnimationFrame(animate);
    };

    frameId.current = requestAnimationFrame(animate);
    return () => {
      if (frameId.current) cancelAnimationFrame(frameId.current);
    };
  }, [config, isGathering, targetText]);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" />;
};

export default FireflyEngine;