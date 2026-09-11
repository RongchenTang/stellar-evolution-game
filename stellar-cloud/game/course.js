(() => {
  const chapters = [
    { name: "导入", route: "opening", title: "如果你是一颗恒星，你会如何度过一生？", question: "恒星也有出生、成长和终结。决定它命运的关键是什么？", points: ["本课以你领养的恒星为线索，串联诞生、主序星、中年危机与最终归宿。", "学习时始终追踪三件事：质量如何变化、能量从哪里来、核心和外层发生什么。", "完成互动后，先阅读结论再进入下一关；你也可以用导航回看任何章节。"], flow: "分子云 → 原恒星 → 主序星 → 演化分支 → 恒星遗产", answer: "先记录你的猜想。课程结束时，用质量、聚变和引力三个关键词解释你的恒星结局。", source: "课件第9—11页；讲义恒星成长记录" },
    { name: "01 诞生", route: "l1", title: "从一团气体，到恒星胚胎", question: "核聚变还没有开始时，原恒星为什么会升温？", points: ["恒星的原料来自气体和尘埃组成的星云，其中气体主要是氢和氦。局部区域在引力作用下收缩。", "收缩使引力势能转化为热能；吸积则继续改变原恒星的质量。", "在游戏中，以约0.08个太阳质量作为持续氢聚变的门槛。调整质量之前，先预测它会改变哪一种结局。"], flow: "云团收缩 → 核心升温 → 吸积成长 → 尝试启动持续氢聚变", answer: "升温不一定来自核聚变。诞生阶段的引力收缩本身就能提供热量。", source: "课件第15—20页；讲义第17页" },
    { name: "02 平衡", route: "l2", title: "主序星：漫长生命中的动态平衡", question: "核聚变越强，恒星就一定越稳定吗？", points: ["核心中的氢聚变为氦，部分质量转化为能量。恒星的光与热并非普通的化学燃烧。", "引力使恒星收缩，内部压力提供支撑。游戏里的压力与稳定度是理解平衡的示意指标，不是真实恒星的数值模拟。", "主序阶段占据恒星生命的大部分。大质量恒星虽然燃料多，却消耗得更快：太阳主序寿命约100亿年，大质量恒星可短至千万年量级。", "赫罗图用光度与表面温度描述恒星：主序星形成一条带，红巨星与白矮星位于其他区域。"], flow: "核心氢聚变提供能量 ↔ 压力支撑与引力收缩相平衡", answer: "关键是平衡，而不是单方面增强。观察按下与松开时两个压力条的差距，再决定操作。", source: "课件第21—25页；讲义第17—18页" },
    { name: "03 危机", route: "l3", title: "同一颗恒星，核心收缩而外层膨胀", question: "核心温度上升时，为什么恒星表面反而可以变红？", points: ["核心氢燃料逐渐耗尽，氦在核心积累；恒星离开长期稳定的主序阶段。", "核心再次收缩并升温，核心周围的壳层继续发生聚变。请分清核心与壳层，不要把恒星想成温度均匀的球。", "外层膨胀后，表面温度可以降低。颜色反映表面温度，并不直接代表核心温度。", "先完成下方因果排序，再比较中质量与大质量恒星的后续路径。"], flow: "观察重点：燃料在哪里？哪里在收缩？哪里在膨胀？", answer: "核心和表面是不同区域。核心升温与外层膨胀、表面降温可以同时发生。", source: "课件第26—29页；讲义第18页" },
    { name: "04 分叉", route: "l4", title: "同样走向晚年，不同的告别方式", question: "恒星抛出的物质去了哪里？留下来的又是什么？", points: ["中质量路线：外层气体被抛出，形成行星状星云；中心留下致密的恒星残骸。", "大质量路线：核心经历更重元素的核反应，形成分层结构；用下方洋葱层互动辨认由外到内的层次。", "比较两条路线时，请分别记录外层物质的去向与核心的归宿，不要只记最后一个名称。"], flow: "中质量：外层抛出 → 行星状星云 ｜ 大质量：分层演化 → 核心坍缩", answer: "外层物质回到星际空间，残留核心继续演化。它们共同构成恒星留给宇宙的遗产。", source: "课件第30—40页；讲义第18—19页" },
    { name: "05 遗产", route: "l5", title: "一生结束，物质的故事还在继续", question: "恒星的结局只是一个名字，还是下一段故事的起点？", points: ["对比三类归宿：白矮星、中子星与黑洞。重点比较形成路径、尺度与致密程度。", "脉冲星把自转与周期性信号联系起来，可以被比作宇宙灯塔；黑洞的讨论则引入事件视界。", "双星互动让我们看到：恒星并非总是独立演化。课堂中的相邻座位是合作情境，不是真实双星形成机制。", "写下你的墓志铭或寄语，附上一句科学解释：为什么你的恒星走向这个结局？"], flow: "恒星释放物质 → 参与后续天体形成 → 物质循环延续", answer: "回顾出生质量、能量来源和演化分支，画出你这颗恒星的生命路线。再找一位结局不同的同学比较。", source: "课件第34—55页；讲义第19—21页" }
  ];
  window.mountCourse = (screen, state, navigate) => {
    const match = /^l([1-5])/.exec(state.route);
    const index = match ? Number(match[1]) : state.route === "opening" ? 0 : 5;
    const aftermath = chapters[index];
    const chapter = index === 4 ? {
      ...aftermath,
      title: "恒星内部的核聚变：为什么会形成洋葱层？",
      question: "越靠近核心，温度越高。不同元素的核反应会出现在相同的位置吗？",
      points: [
        "核聚变是原子核参与的反应，不是化学燃烧。主序阶段，恒星核心主要把氢转化为氦；氢耗尽后，核心收缩升温，为后续核反应创造条件。",
        "氦聚变可以生成碳，碳还可通过俘获氦核生成氧。大质量恒星能达到更高温度，继续经历碳、氧、硅等燃烧阶段，形成更重的元素。这里描述的是多个反应阶段，并非每一步都是两个同名原子核直接合成下一个元素。",
        "不同燃料需要不同的温度条件。核心演化到新的燃烧阶段时，外侧较冷的壳层仍可能进行较早阶段的反应，于是形成分层结构，而不是整颗恒星同时燃烧同一种元素。",
        "本游戏采用六层简化模型。由外到内辨认：氢层、氦层、碳层、氧层、硅层，以及中央的铁核心。真实结构更复杂，这里省略了氖等层次。",
        "注意区分燃烧壳层与残留核心：铁核心不是继续通过聚变释放能量的燃烧层。填入“铁”是在标记中心积累的物质。",
        "洋葱层对应大质量恒星的演化路线，中质量恒星不会完整经历这套重元素燃烧过程。先理解层次，再进行下方互动。"
      ],
      flow: "外侧、较冷：氢 → 氦 → 碳 → 氧 → 硅 → 铁核心：内侧、较热（六层教学示意）",
      answer: "从外向内，用温度条件与燃烧阶段理解顺序。壳层名称帮助辨认结构，不表示该层只含一种元素。",
      source: "课件第20—21、28、30—31页；洋葱层为游戏简化模型"
    } : aftermath;
    const section = document.createElement("section");
    section.className = "course";
    section.setAttribute("aria-label", "本章学习指南");
    section.innerHTML = `<nav aria-label="课程章节">${chapters.map((item, chapterIndex) => `<button type="button" data-chapter="${chapterIndex}" ${chapterIndex === index ? 'aria-current="step"' : ""}>${item.name}</button>`).join("")}</nav><div class="eyebrow">ADOPT A STAR · 大学互动课堂</div><h2>${chapter.title}</h2><p class="question">想一想：${chapter.question}</p><details open><summary>知识线索 · 先理解，再体验</summary><ul>${chapter.points.map(point => `<li>${point}</li>`).join("")}</ul><p class="flow">${chapter.flow}</p></details><details><summary>讨论后展开 · 回顾与解释</summary><p>${chapter.answer}</p></details><small>材料定位：${chapter.source}。本版沿用原游戏与讲义的教学框架，暂未对原材料作系统科学校订；游戏质量分界属于课堂简化。</small><footer>${index > 0 ? `<button class="btn btn--ghost" data-chapter="${index - 1}">上一章</button>` : ""}${index < 5 ? `<button class="btn btn--ghost" data-chapter="${index + 1}">下一章 · 课堂浏览</button>` : ""}<button class="btn" data-play>进入本页互动 ↓</button></footer>`;
    screen.prepend(section);
    if (index === 4 && (Number(state.mass) <= 8 || Number(state.l4Step) >= 6)) {
      const review = document.createElement("section");
      review.className = "course course--aftermath";
      review.setAttribute("aria-label", "互动后的命运分叉讨论");
      review.innerHTML = `<div class="eyebrow">互动之后 · 从内部反应走向恒星命运</div><h2>${aftermath.title}</h2><p class="question">想一想：${aftermath.question}</p><h3>知识线索 · 命运分叉</h3><ul>${aftermath.points.map(point => `<li>${point.replace("用下方洋葱层互动辨认由外到内的层次", "刚才的洋葱层互动展示了由外到内的层次")}</li>`).join("")}</ul><p class="flow">${aftermath.flow}</p><details><summary>讨论后展开 · 回顾与解释</summary><p>${aftermath.answer}</p></details><small>材料定位：${aftermath.source}</small>`;
      const continueButton = screen.querySelector("#btnSupernova, #btnToL5");
      if (continueButton) {
        const anchor = continueButton.closest(".row") || continueButton;
        anchor.parentNode.insertBefore(review, anchor);
      }
      else screen.append(review);
    }
    section.querySelectorAll("[data-chapter]").forEach(button => button.addEventListener("click", () => navigate(chapters[Number(button.dataset.chapter)].route)));
    section.querySelector("[data-play]").addEventListener("click", () => section.nextElementSibling?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
})();
