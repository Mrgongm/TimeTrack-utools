# TimeTrack-utools

一个个人工时记录 uTools 插件。目标是让用户随时记录"什么时候开始干活、什么时候暂停"，并随时添加要做的工作内容。

## Language

**Project**:
一个工作容器，下挂多个 Task。Project 本身不直接记录工时。
_Avoid_: 工作目录、category、文件夹

**Task**:
一个可独立计时的具体工作单元。可有零个或一个 parent Task（为空即挂在其所属 Project 下的顶层），可有零或多个 child Task。"任务"和"子任务"在本项目里是同一实体，只是层级不同；二者对计时、暂停、完成状态的处理完全对称。
_Avoid_: 子任务（统一用 Task，需要时用 parent/child task 区分）、work item、todo

**Session**:
Task 的一段连续工作时间区间，由开始时间与结束时间定义。"开始计时"创建一个新 Session（end 暂为空），"暂停"为当前 Session 填入结束时间。一个 Task 可有任意多个 Session。
_Avoid_: 时间段、time entry、record、log、interval（统一用 Session）

**Active Session**:
全应用同一时刻至多一个。用户开始 Task B 的 Session 时，若 Task A 当前有 Active Session，必须先暂停 A。"当前在计时"在 UI 上是单一焦点。
_Avoid_: running timer、current timer

## Invariants

- **Single active session**：任意时刻 0 或 1 个 Active Session，跨所有 Project / Task。Sessions 之间不存在时间重叠。
- **Independent task time**：每个 Task 自己的 Sessions 与其他 Task（包括其 parent / child）的 Sessions 互不相干。"Task A 的工时"分两个口径：
  - **自身工时** = A 的 Sessions 时长之和。
  - **合计工时** = 自身工时 + 所有后代 Task 的合计工时（递归）。
- **Creation is orthogonal to timing**：创建一个 Task（包括创建某 Task 的 child）不会影响任何 Active Session，也不会迁移或拆分任何已有 Session。
