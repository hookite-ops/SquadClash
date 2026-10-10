// 효과음 굽기를 화면과 다른 줄기(워커)에서: 굽는 동안 게임이 끊기지 않게. 하나 구울 때마다 바로 돌려보냄
import { bakeList, runJob } from './sfxbank.js';

onmessage = (e) => {
  const sr = e.data;
  for (const j of bakeList()) {
    const chs = runJob(j, sr);
    postMessage({ where: j.where, key: j.key, half: j.half, chs }, chs.map((c) => c.buffer));
  }
  postMessage({ done: true });
};
