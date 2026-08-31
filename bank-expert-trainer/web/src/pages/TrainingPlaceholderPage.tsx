export function TrainingPlaceholderPage() {
  return (
    <>
      <h1>培训台（二期占位）</h1>
      <div className="card">
        <p>对标 Posh AI Training Simulator，二期将提供：</p>
        <ul>
          <li>情景库（柜面咨询 / 身份核验 / 投诉安抚）</li>
          <li>与已发布员工 Skill 的文字对练</li>
          <li>共情 / 合规 / 准确等多维评分</li>
          <li>学员进度</li>
        </ul>
        <p className="muted">第一期请先在蒸馏台产出 Skill，本页仅预留入口与只读 API。</p>
        <button type="button" disabled>
          开始对练（即将上线）
        </button>
      </div>
    </>
  );
}
