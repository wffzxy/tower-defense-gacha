// 寻路系统：超平坦空地，使用固定 waypoints 路径
// 怪物按 waypoint 顺序移动到基地

export interface Waypoint {
  x: number;
  y: number;
}

export class PathSystem {
  waypoints: Waypoint[] = [];
  // 路径附近的可放置区域排除带（防止塔放在路径上）
  pathWidth: number;

  constructor(width: number, height: number, pathWidth = 36) {
    this.pathWidth = pathWidth;
    this.buildPath(width, height);
  }

  // 构建 S 形路径，让怪物从左侧入口绕到右侧基地
  private buildPath(w: number, h: number) {
    const margin = 60;
    this.waypoints = [
      { x: -20, y: h * 0.25 },
      { x: w * 0.25, y: h * 0.25 },
      { x: w * 0.25, y: h * 0.75 },
      { x: w * 0.55, y: h * 0.75 },
      { x: w * 0.55, y: h * 0.25 },
      { x: w * 0.8, y: h * 0.25 },
      { x: w * 0.8, y: h * 0.5 },
      { x: w + 20, y: h * 0.5 }
    ];
  }

  // 给定当前位置和路径索引，返回下一个目标点（基地为终点）
  nextTarget(x: number, y: number, pathIndex: number): { tx: number; ty: number; reachedEnd: boolean; nextIndex: number } | null {
    if (pathIndex >= this.waypoints.length) {
      return null;
    }
    const wp = this.waypoints[pathIndex];
    const dx = wp.x - x;
    const dy = wp.y - y;
    const dist = Math.hypot(dx, dy);
    // 接近 waypoint 即视为到达（避免抖动）
    if (dist < 4) {
      const nextIndex = pathIndex + 1;
      if (nextIndex >= this.waypoints.length) {
        return { tx: wp.x, ty: wp.y, reachedEnd: true, nextIndex };
      }
      const next = this.waypoints[nextIndex];
      return { tx: next.x, ty: next.y, reachedEnd: false, nextIndex };
    }
    return { tx: wp.x, ty: wp.y, reachedEnd: false, nextIndex: pathIndex };
  }

  // 检查某点是否离路径太近（不能放塔）
  isOnPath(x: number, y: number): boolean {
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const a = this.waypoints[i];
      const b = this.waypoints[i + 1];
      const dist = pointToSegmentDist(x, y, a.x, a.y, b.x, b.y);
      if (dist < this.pathWidth) return true;
    }
    return false;
  }

  get spawnPoint(): Waypoint {
    return this.waypoints[0];
  }

  get basePoint(): Waypoint {
    return this.waypoints[this.waypoints.length - 1];
  }
}

function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
