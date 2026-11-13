## 先学这几个基本写法

直接在正文框输入 Markdown，点击“预览”查看排版，点击“保存笔记”保存。正文以原始文本保存，已有笔记可以继续编辑。

| 想要的效果 | 在正文中输入 |
| --- | --- |
| 一级标题 | `# 标题` |
| 二级标题 | `## 标题` |
| 三级标题 | `### 标题` |
| **粗体** | `**粗体**` |
| *斜体* | `*斜体*` |
| ~~删除线~~ | `~~删除线~~` |
| 行内代码 | 用一对反引号包住内容，例如：`` `print("hello")` `` |
| 分隔线 | 单独一行写 `---`，上下留空行 |

标题的 `#` 后面需要一个空格。段落之间空一行；同一段里普通回车会合并为一个段落。确实要在同一段中换行时，在上一行末尾加两个空格再回车。

```markdown
# 今天的学习记录

## 学了什么

今天复习了**极限**，还整理了一段 `Python` 代码。

这是另一个段落。
```

## 列表与引用

无序列表用 `- `，有序列表用 `1. `。嵌套列表在下一级前面加四个空格。引用用 `> `，适合摘录书中的句子。

```markdown
- 阅读教材
- 整理笔记
    - 记录定义
    - 推导公式

1. 先看问题
2. 再写推导
3. 最后做练习

> 理解比记忆更重要。
```

## 链接、图片与表格

链接写成 `[显示文字](网址)`；图片在前面再加一个 `!`。图片需要使用浏览器可以访问的地址，电脑上的本地文件路径不会自动上传。

```markdown
[参考资料](https://example.com)

![图片说明](https://example.com/image.png)

| 日期 | 学习内容 | 状态 |
| --- | --- | --- |
| 周一 | 极限 | 已复习 |
| 周二 | 积分 | 待练习 |
```

表格效果：

| 日期 | 学习内容 | 状态 |
| --- | --- | --- |
| 周一 | 极限 | 已复习 |
| 周二 | 积分 | 待练习 |

## 程序代码

短代码使用一对反引号。多行代码使用三枚反引号围起来，并在第一行注明语言。代码块中的空格、缩进和换行会保留，里面的 `$` 也不会变成公式。

下面是可以直接复制的 Markdown 源码：

````markdown
调用 `print()` 输出结果。

```python
def square(x):
    return x ** 2

print(square(3))
```
````

代码块效果：

```python
def square(x):
    return x ** 2

print(square(3))
```

目前支持高亮的语言标识有 `python`、`javascript`、`typescript`、`bash`、`sql`、`json`、`html`、`css`。其他语言仍可用代码块展示。

## Markdown 绘图

用语言标识为 `plot` 的代码块绘制图形。默认绘制二维函数图；设置 `dimension: 3` 后绘制三维曲面。每一行使用 `名称: 值`，空行和以 `#` 开头的行会被忽略。

### 语法速查

| 设置项 | 适用范围 | 写法与说明 |
| --- | --- | --- |
| `dimension` | 二维/三维 | `2` 或 `3`，默认是 `2`。三维图必须在 `z` 前设置为 `3`。 |
| `fn` | 二维 | 函数表达式，可重复多次叠加曲线，最多 8 条。例如 `fn: sin(x)`。 |
| `z` | 三维 | 曲面表达式，使用变量 `x`、`y`，例如 `z: sin(sqrt(x^2+y^2))`。 |
| `x` | 二维/三维 | x 轴范围，格式为 `最小值, 最大值`，例如 `x: -5, 5`。 |
| `y` | 二维/三维 | y 轴范围，格式为 `最小值, 最大值`。 |
| `zrange` | 三维 | z 轴范围，格式为 `最小值, 最大值`。 |
| `point` | 二维 | 标记点，格式为 `x, y, filled` 或 `x, y, open`；省略样式时为实心点。 |
| `title` | 二维 | 图标题，例如 `title: 正弦曲线`。 |
| `xlabel` | 二维 | x 轴名称，例如 `xlabel: 时间 t`。 |
| `ylabel` | 二维 | y 轴名称，例如 `ylabel: 位移 s`。 |

坐标范围必须是两个递增的有限数字，绝对值不能超过 `1000000`。每个图最多标记 20 个点。函数表达式只允许字母、数字、空格和常见运算符，不会执行 JavaScript。

### 表达式写法

可以使用 `+`、`-`、`*`、`/`、`^`、括号和 `%`，以及常用函数 `sin`、`cos`、`tan`、`sqrt`、`abs`、`exp`、`log`。例如：

| 数学写法 | 绘图表达式 |
| --- | --- |
| $y=x^2$ | `fn: x^2` |
| $y=\sin x$ | `fn: sin(x)` |
| $y=e^{-x^2}$ | `fn: exp(-x^2)` |
| $z=\sqrt{x^2+y^2}$ | `z: sqrt(x^2+y^2)` |

函数名和变量名使用英文半角字符；不要写 `$...$`、反斜杠 LaTeX 命令或 JavaScript 代码。表达式错误时，源码块会保留，并在下方显示错误提示。

下面的例子绘制 $\frac{\sin x}{x}$、水平线 $y=1$，并在 $(0,1)$ 标出空心点：

````markdown
```plot
fn: sin(x)/x
fn: 1
x: -1, 1
y: 0.8, 1.1
title: sin(x)/x 在 x=0 附近
xlabel: x
ylabel: y
point: 0, 1, open
```
````

实际图形：

```plot
fn: sin(x)/x
fn: 1
x: -1, 1
y: 0.8, 1.1
title: sin(x)/x 在 x=0 附近
xlabel: x
ylabel: y
point: 0, 1, open
```

函数绘图支持数学表达式，不执行 JavaScript；语法错误时会保留源码并显示错误提示。

二维图的完整字段模板：

````markdown
```plot
# 每个字段单独一行；fn 可以重复
fn: sin(x)
fn: cos(x)
x: -6.28, 6.28
y: -1.2, 1.2
title: 三角函数
xlabel: x
ylabel: y
point: 0, 0, filled
point: 1.57, 1, open
```
````

三维示例绘制 $z=\sin(\sqrt{x^2+y^2})$：

````markdown
```plot
dimension: 3
z: sin(sqrt(x^2+y^2))
x: -5, 5
y: -5, 5
zrange: -1.2, 1.2
```
````

实际曲面：

```plot
dimension: 3
z: sin(sqrt(x^2+y^2))
x: -5, 5
y: -5, 5
zrange: -1.2, 1.2
```

三维图的最小模板如下。`z` 表达式必须使用 `x`、`y` 两个变量；`zrange` 只控制显示范围，不会截断函数计算。当前笔记会将三维曲面保存为静态 SVG，适合查看和打印。

````markdown
```plot
dimension: 3
z: x^2 - y^2
x: -2, 2
y: -2, 2
zrange: -4, 4
```
````

### 常见问题

- 二维图至少需要一行 `fn`；三维图至少需要一行 `z`。
- `z` 写在 `dimension: 3` 之前会被按二维语法检查并报错，请调整顺序。
- `fn` 不能用于三维图，三维曲面请改用 `z`。
- 范围、点坐标使用英文逗号 `,`；字段名称不区分大小写，但表达式函数建议使用小写。
- 一个文档可以包含多个 `plot` 代码块，每个代码块独立绘制。

## 数学公式如何排版

公式使用 LaTeX 数学语法。网站在预览、保存后的阅读页和公开主页中使用 MathJax 3 排版，不需要额外安装 LaTeX，也不用运行编译命令。它负责展示公式，不会自动算出答案。

行内公式：用一对 `$` 包住公式，适合放在句子里，`$` 与内部公式之间不要留空格。

```markdown
由 $a^2+b^2=c^2$ 可知，直角三角形的三边满足勾股定理。
```

效果：由 $a^2+b^2=c^2$ 可知，直角三角形的三边满足勾股定理。

独立公式：前后各用一行 `$$`，并在整块公式前后留空行。长公式、推导和带上下限的积分、求和建议这样写。

```markdown
下面是一个独立公式：

$$
\int_0^1 x^2\,\mathrm{d}x = \frac{1}{3}
$$

接下来继续写解释。
```

效果：

$$
\int_0^1 x^2\,\mathrm{d}x = \frac{1}{3}
$$

以下表格“输入”列展示公式本身，复制后放进 `$...$` 或独立的 `$$` 中即可。反斜杠 `\` 在笔记里只需要写一次。

## 上下标、分数与括号

`^` 表示上标，`_` 表示下标；多个字符用 `{}` 括起来。`\frac{分子}{分母}` 表示分数。

| 名称 | 输入 | 效果 |
| --- | --- | --- |
| 平方 | `x^2` | $x^2$ |
| 多字符上标 | `x^{n+1}` | $x^{n+1}$ |
| 下标 | `a_n` | $a_n$ |
| 同时有上下标 | `a_i^2` | $a_i^2$ |
| 分数 | `\frac{a+b}{c+d}` | $\frac{a+b}{c+d}$ |
| 较大的行内分数 | `\dfrac{1}{1+x}` | $\dfrac{1}{1+x}$ |
| 自动调整大小的括号 | `\left(\frac{a}{b}\right)` | $\left(\frac{a}{b}\right)$ |
| 绝对值 | `\lvert x\rvert` | $\lvert x\rvert$ |
| 二项式系数 | `\binom{n}{k}` | $\binom{n}{k}$ |

## 极限

极限用 `\lim`，趋近用 `\to`，无穷大用 `\infty`；趋近条件放在下标中。

| 名称 | 输入 | 效果 |
| --- | --- | --- |
| 一般极限 | `\lim_{x\to a} f(x)` | $\lim_{x\to a} f(x)$ |
| 趋于无穷 | `\lim_{n\to\infty} a_n` | $\lim_{n\to\infty} a_n$ |
| 左极限 | `\lim_{x\to 0^-} f(x)` | $\lim_{x\to 0^-} f(x)$ |
| 右极限 | `\lim_{x\to 0^+} f(x)` | $\lim_{x\to 0^+} f(x)$ |

完整例子：

```markdown
$$
\lim_{x\to 0}\frac{\sin x}{x}=1
$$
```

$$
\lim_{x\to 0}\frac{\sin x}{x}=1
$$

```markdown
$$
\lim_{n\to\infty}\left(1+\frac{1}{n}\right)^n=e
$$
```

$$
\lim_{n\to\infty}\left(1+\frac{1}{n}\right)^n=e
$$

## 积分

积分用 `\int`，下限写在 `_` 后，上限写在 `^` 后。`\,` 添加一点间距，`\mathrm{d}` 把微分符号 d 排成直体。

| 名称 | 输入 | 效果 |
| --- | --- | --- |
| 不定积分 | `\int f(x)\,\mathrm{d}x` | $\int f(x)\,\mathrm{d}x$ |
| 定积分 | `\int_a^b f(x)\,\mathrm{d}x` | $\int_a^b f(x)\,\mathrm{d}x$ |
| 广义积分 | `\int_0^{\infty} e^{-x}\,\mathrm{d}x` | $\int_0^{\infty} e^{-x}\,\mathrm{d}x$ |
| 二重积分 | `\iint_D f(x,y)\,\mathrm{d}x\,\mathrm{d}y` | $\iint_D f(x,y)\,\mathrm{d}x\,\mathrm{d}y$ |
| 三重积分 | `\iiint_V f\,\mathrm{d}V` | $\iiint_V f\,\mathrm{d}V$ |
| 闭合曲线积分 | `\oint_C f(z)\,\mathrm{d}z` | $\oint_C f(z)\,\mathrm{d}z$ |

```markdown
$$
\int x^2\,\mathrm{d}x=\frac{x^3}{3}+C
$$
```

$$
\int x^2\,\mathrm{d}x=\frac{x^3}{3}+C
$$

## 求和与连乘

求和用 `\sum`，连乘用 `\prod`，上下限的写法与积分一致。独立公式中的求和上下限会排在符号的上方和下方。

| 名称 | 输入 | 效果 |
| --- | --- | --- |
| 有限求和 | `\sum_{i=1}^{n} a_i` | $\sum_{i=1}^{n} a_i$ |
| 无穷级数 | `\sum_{n=0}^{\infty} x^n` | $\sum_{n=0}^{\infty} x^n$ |
| 连乘 | `\prod_{i=1}^{n} a_i` | $\prod_{i=1}^{n} a_i$ |

```markdown
$$
\sum_{i=1}^{n} i=\frac{n(n+1)}{2}
$$
```

$$
\sum_{i=1}^{n} i=\frac{n(n+1)}{2}
$$

## 开方、指数、对数与三角函数

平方根用 `\sqrt{内容}`，n 次根用 `\sqrt[n]{内容}`。

| 名称 | 输入 | 效果 |
| --- | --- | --- |
| 平方根 | `\sqrt{x}` | $\sqrt{x}$ |
| 复杂根式 | `\sqrt{x^2+y^2}` | $\sqrt{x^2+y^2}$ |
| 立方根 | `\sqrt[3]{x}` | $\sqrt[3]{x}$ |
| n 次根 | `\sqrt[n]{a}` | $\sqrt[n]{a}$ |
| 指数函数 | `e^{x+1}` | $e^{x+1}$ |
| 自然对数 | `\ln x` | $\ln x$ |
| 指定底的对数 | `\log_2 n` | $\log_2 n$ |
| 三角函数 | `\sin x,\quad\cos x,\quad\tan x` | $\sin x,\quad\cos x,\quad\tan x$ |

完整的求根公式：

```markdown
$$
x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}
$$
```

$$
x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}
$$

## 导数、偏导数与向量

| 名称 | 输入 | 效果 |
| --- | --- | --- |
| 一阶导数 | `f'(x)` | $f'(x)$ |
| 二阶导数 | `f''(x)` | $f''(x)$ |
| 微分形式 | `\frac{\mathrm{d}y}{\mathrm{d}x}` | $\frac{\mathrm{d}y}{\mathrm{d}x}$ |
| 偏导数 | `\frac{\partial f}{\partial x}` | $\frac{\partial f}{\partial x}$ |
| 二阶偏导 | `\frac{\partial^2 f}{\partial x^2}` | $\frac{\partial^2 f}{\partial x^2}$ |
| 梯度 | `\nabla f` | $\nabla f$ |
| 向量箭头 | `\vec{v}` | $\vec{v}$ |
| 粗体向量 | `\mathbf{x}` | $\mathbf{x}$ |
| 点积与叉积 | `\vec{a}\cdot\vec{b},\quad\vec{a}\times\vec{b}` | $\vec{a}\cdot\vec{b},\quad\vec{a}\times\vec{b}$ |

## 常见符号、希腊字母与集合

| 名称 | 输入 | 效果 |
| --- | --- | --- |
| 乘、除 | `a\times b,\quad a\div b` | $a\times b,\quad a\div b$ |
| 点乘、正负 | `a\cdot b,\quad\pm x` | $a\cdot b,\quad\pm x$ |
| 不等于、约等于 | `a\ne b,\quad a\approx b` | $a\ne b,\quad a\approx b$ |
| 小于等于、大于等于 | `a\le b,\quad a\ge b` | $a\le b,\quad a\ge b$ |
| 无穷大 | `\infty` | $\infty$ |
| 常用希腊字母 | `\alpha,\beta,\gamma,\theta,\lambda,\mu,\sigma,\pi,\omega` | $\alpha,\beta,\gamma,\theta,\lambda,\mu,\sigma,\pi,\omega$ |
| 大写希腊字母 | `\Delta,\Sigma,\Omega` | $\Delta,\Sigma,\Omega$ |
| 实数、自然数、整数 | `\mathbb{R},\mathbb{N},\mathbb{Z}` | $\mathbb{R},\mathbb{N},\mathbb{Z}$ |
| 属于、不属于、子集 | `x\in A,\quad x\notin B,\quad A\subseteq B` | $x\in A,\quad x\notin B,\quad A\subseteq B$ |
| 并集与交集 | `A\cup B,\quad A\cap B` | $A\cup B,\quad A\cap B$ |
| 空集 | `\varnothing` | $\varnothing$ |
| 箭头与推出 | `x\to 0,\quad A\Rightarrow B,\quad A\Leftrightarrow B` | $x\to 0,\quad A\Rightarrow B,\quad A\Leftrightarrow B$ |
| 省略号 | `a_1,a_2,\ldots,a_n` | $a_1,a_2,\ldots,a_n$ |

公式内部想写普通文字，可以用 `\text{文字}`，例如 `$x>0\quad\text{当 x 为正数时}$`。

## 数学符号分类速查

下面列出常见数学符号的 LaTeX 写法。将“输入”列放进 `$...$` 或 `$$...$$` 中即可；符号在不同学科中可能有不同含义。

### 希腊字母

小写希腊字母通常用反斜杠加名称；大写形式也可直接按名称输入。少数大写字母与英文字母外形相同，因此没有独立命令。

| 类别 | 输入 | 效果 |
| --- | --- | --- |
| 小写（前半） | `\alpha, \beta, \gamma, \delta, \epsilon, \varepsilon, \zeta, \eta, \theta, \vartheta, \iota, \kappa` | $\alpha, \beta, \gamma, \delta, \epsilon, \varepsilon, \zeta, \eta, \theta, \vartheta, \iota, \kappa$ |
| 小写（后半） | `\lambda, \mu, \nu, \xi, o, \pi, \varpi, \rho, \varrho, \sigma, \varsigma, \tau` | $\lambda, \mu, \nu, \xi, o, \pi, \varpi, \rho, \varrho, \sigma, \varsigma, \tau$ |
| 小写（续） | `\upsilon, \phi, \varphi, \chi, \psi, \omega` | $\upsilon, \phi, \varphi, \chi, \psi, \omega$ |
| 大写（有专用命令） | `\Gamma, \Delta, \Theta, \Lambda, \Xi, \Pi, \Sigma, \Upsilon, \Phi, \Psi, \Omega` | $\Gamma, \Delta, \Theta, \Lambda, \Xi, \Pi, \Sigma, \Upsilon, \Phi, \Psi, \Omega$ |

### 运算、比较与逻辑

| 类别 | 输入 | 效果 |
| --- | --- | --- |
| 加减乘除 | `a+b, a-b, a\times b, a\div b` | $a+b, a-b, a\times b, a\div b$ |
| 点乘、叉乘、星号 | `\vec a\cdot\vec b, \vec a\times\vec b, a\ast b` | $\vec a\cdot\vec b, \vec a\times\vec b, a\ast b$ |
| 不等与近似 | `\ne, \approx, \sim, \equiv` | $\ne, \approx, \sim, \equiv$ |
| 大小关系 | `\lt, \le, \gt, \ge` | $\lt, \le, \gt, \ge$ |
| 比例与正比 | `a:b, a\propto b` | $a:b, a\propto b$ |
| 且、或、非 | `\land, \lor, \lnot` | $\land, \lor, \lnot$ |
| 因此、因为 | `\therefore, \because` | $\therefore, \because$ |
| 全称、存在 | `\forall x, \exists x` | $\forall x, \exists x$ |
| 取模 | `a\bmod n` | $a\bmod n$ |

### 集合、箭头与省略号

| 类别 | 输入 | 效果 |
| --- | --- | --- |
| 属于、不属于 | `x\in A, x\notin A` | $x\in A, x\notin A$ |
| 子集、真子集 | `A\subseteq B, A\subset B` | $A\subseteq B, A\subset B$ |
| 并、交、差集 | `A\cup B, A\cap B, A\setminus B` | $A\cup B, A\cap B, A\setminus B$ |
| 空集、全集 | `\varnothing, U` | $\varnothing, U$ |
| 映射、趋近 | `A\to B, x\rightarrow 0` | $A\to B, x\rightarrow 0$ |
| 推出、等价 | `A\Rightarrow B, A\Leftrightarrow B` | $A\Rightarrow B, A\Leftrightarrow B$ |
| 单点、居中、省略 | `a_1,\ldots,a_n; \cdots; \vdots; \ddots` | $a_1,\ldots,a_n; \cdots; \vdots; \ddots$ |

### 字体、装饰与间距

| 效果 | 输入 | 示例 |
| --- | --- | --- |
| 粗体向量/变量 | `\mathbf{v}` | $\mathbf{v}$ |
| 花体集合 | `\mathcal{F}` | $\mathcal{F}$ |
| 黑板粗体数集 | `\mathbb{R}` | $\mathbb{R}$ |
| 向量箭头 | `\vec{AB}` | $\vec{AB}$ |
| 上划线、平均值 | `\overline{AB}, \bar{x}` | $\overline{AB}, \bar{x}$ |
| 波浪/帽子 | `\tilde{x}, \hat{x}` | $\tilde{x}, \hat{x}$ |
| 角度、度数 | `\angle ABC, 90^\circ` | $\angle ABC, 90^\circ$ |
| 直立单位或文字 | `\mathrm{m}, \text{其中}` | $\mathrm{m}, \text{其中}$ |
| 小/中/大间距 | `a\,b, a\;b, a\quad b` | $a\,b, a\;b, a\quad b$ |

## 物理公式、量纲与单位

物理公式通常由“物理量符号 + 数学运算 + 单位”组成。物理量使用斜体（如 `v`），单位使用直立体（如 `\mathrm{m/s}`）；向量可用 `\vec{v}`，变化量常用 `\Delta`。字母不是全领域唯一固定的，第一次出现时建议在文字中说明含义。

### 力学与运动

| 物理量 | 常见符号 | 单位写法 |
| --- | --- | --- |
| 位置、位移 | `x, \vec r, \Delta x` | `\mathrm{m}` |
| 时间、时间间隔 | `t, \Delta t` | `\mathrm{s}` |
| 速度、加速度 | `v, \vec v; a, \vec a` | `\mathrm{m/s}; \mathrm{m/s^2}` |
| 质量、密度 | `m, \rho` | `\mathrm{kg}; \mathrm{kg/m^3}` |
| 力、重力加速度 | `F, \vec F; g` | `\mathrm{N}; \mathrm{m/s^2}` |
| 动量、冲量 | `p, \vec p; J` | `\mathrm{kg\,m/s}; \mathrm{N\,s}` |
| 功、能量、功率 | `W, E; P` | `\mathrm{J}; \mathrm{W}` |
| 压强、弹簧劲度系数 | `p; k` | `\mathrm{Pa}; \mathrm{N/m}` |
| 角度、角速度、角加速度 | `\theta; \omega; \alpha` | `\mathrm{rad}; \mathrm{rad/s}; \mathrm{rad/s^2}` |

示例（匀加速运动和牛顿第二定律）：

```markdown
$$
x=x_0+v_0t+\frac{1}{2}at^2, \qquad \vec F=m\vec a
$$
```

$$
x=x_0+v_0t+\frac{1}{2}at^2, \qquad \vec F=m\vec a
$$

### 电磁学与电路

| 物理量 | 常见符号 | 单位写法 |
| --- | --- | --- |
| 电荷量、电流 | `q, Q; I` | `\mathrm{C}; \mathrm{A}` |
| 电压、电势、电动势 | `U; V; \mathcal{E}` | `\mathrm{V}` |
| 电阻、电导 | `R; G` | `\mathrm{\Omega}; \mathrm{S}` |
| 电场、磁场 | `\vec E; \vec B` | `\mathrm{V/m}; \mathrm{T}` |
| 磁通量、电容 | `\Phi_B; C` | `\mathrm{Wb}; \mathrm{F}` |
| 电感、电阻率 | `L; \rho` | `\mathrm{H}; \mathrm{\Omega\,m}` |

### 热学、波动与光学

| 物理量 | 常见符号 | 单位写法 |
| --- | --- | --- |
| 温度、温差 | `T; \Delta T` | `\mathrm{K}` |
| 热量、比热容 | `Q; c` | `\mathrm{J}; \mathrm{J/(kg\,K)}` |
| 物质的量、压强 | `n; p` | `\mathrm{mol}; \mathrm{Pa}` |
| 波长、频率、周期 | `\lambda; f; T` | `\mathrm{m}; \mathrm{Hz}; \mathrm{s}` |
| 波速、振幅 | `v; A` | `\mathrm{m/s};` 与原量相同 |
| 折射率、焦距 | `n; f` | 无量纲；`\mathrm{m}` |

### 常见 SI 基本单位与导出单位

单位符号大小写有严格区别：`m` 是米，`M` 是兆前缀；`s` 是秒，`S` 是西门子。单位用直立体，乘法可用 `\,` 留出间距，除法可用负指数。

| 量 | 单位名称与符号 | 公式输入示例 |
| --- | --- | --- |
| 长度、质量、时间 | 米 `\mathrm{m}`；千克 `\mathrm{kg}`；秒 `\mathrm{s}` | `3\,\mathrm{m}, 2\,\mathrm{kg}, 5\,\mathrm{s}` |
| 电流、温度、物质的量、发光强度 | 安培 `\mathrm{A}`；开尔文 `\mathrm{K}`；摩尔 `\mathrm{mol}`；坎德拉 `\mathrm{cd}` | `2\,\mathrm{A}, 300\,\mathrm{K}, 5\,\mathrm{cd}` |
| 速度、加速度 | 米每秒 `\mathrm{m/s}`；米每二次方秒 `\mathrm{m/s^2}` | `9.8\,\mathrm{m/s^2}` |
| 力、能量、功率 | 牛顿 `\mathrm{N}`；焦耳 `\mathrm{J}`；瓦特 `\mathrm{W}` | `10\,\mathrm{N}, 5\,\mathrm{J}` |
| 压强、电荷、电压 | 帕斯卡 `\mathrm{Pa}`；库仑 `\mathrm{C}`；伏特 `\mathrm{V}` | `101\,\mathrm{kPa}, 2\,\mathrm{C}` |
| 频率、电阻、电容 | 赫兹 `\mathrm{Hz}`；欧姆 `\mathrm{\Omega}`；法拉 `\mathrm{F}` | `50\,\mathrm{Hz}, 10\,\mathrm{\Omega}` |
| 磁场、磁通量 | 特斯拉 `\mathrm{T}`；韦伯 `\mathrm{Wb}` | `0.2\,\mathrm{T}` |

### 常见物理常数

| 常数 | 符号 | 近似值（SI） |
| --- | --- | --- |
| 光速 | `c` | `3.00\times10^8\,\mathrm{m/s}` |
| 重力加速度（近地表） | `g` | `9.81\,\mathrm{m/s^2}` |
| 普朗克常数 | `h` | `6.626\times10^{-34}\,\mathrm{J\,s}` |
| 元电荷 | `e` | `1.602\times10^{-19}\,\mathrm{C}` |
| 阿伏伽德罗常数 | `N_A` | `6.022\times10^{23}\,\mathrm{mol^{-1}}` |

完整物理公式示例：

```markdown
$$
E_k=\frac{1}{2}mv^2, \qquad pV=nRT
$$
```

$$
E_k=\frac{1}{2}mv^2, \qquad pV=nRT
$$

## 矩阵、分段函数与多行推导

矩阵用 `bmatrix`，列与列之间用 `&`，行与行之间用两个反斜杠 `\\`。这里的 `\\` 表示公式内部换行，和普通 Markdown 换行不同。

```markdown
$$
A=\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
$$
```

$$
A=\begin{bmatrix}
1 & 2 \\
3 & 4
\end{bmatrix}
$$

将 `bmatrix` 换成 `pmatrix` 就是圆括号矩阵。

分段函数用 `cases`：

```markdown
$$
f(x)=\begin{cases}
x^2, & x\ge 0 \\
-x, & x<0
\end{cases}
$$
```

$$
f(x)=\begin{cases}
x^2, & x\ge 0 \\
-x, & x<0
\end{cases}
$$

多行推导用 `aligned`，将需要对齐的位置标成 `&`：

```markdown
$$
\begin{aligned}
(a+b)^2 &= (a+b)(a+b) \\
&= a^2+2ab+b^2
\end{aligned}
$$
```

$$
\begin{aligned}
(a+b)^2 &= (a+b)(a+b) \\
&= a^2+2ab+b^2
\end{aligned}
$$

## 可复制的学习日记模板

将下面整段复制到笔记正文，替换日期、内容和公式即可。

````markdown
# 学习日记 · 2026-10-26

## 今天学了什么

- 复习极限的定义
- 练习定积分
- 写一段验证代码

## 一个重要公式

当 $x\to 0$ 时：

$$
\lim_{x\to 0}\frac{\sin x}{x}=1
$$

## 我的理解

先用自己的话解释结论，再记录推导过程中不明白的地方。

> 教材中的关键结论可以放在引用里。

## 代码实验

```python
import math

x = 0.001
print(math.sin(x) / x)
```

## 明天继续

1. 补完习题
2. 回顾今天的疑问
````

## 公式不显示时如何检查

- 行内公式使用 `$x^2$`，不要写成 `$ x^2 $`；本站以 `$` 和独立成行的 `$$` 作为公式标记。
- 独立公式的开始和结束都要有一行 `$$`，并在公式块前后空一行。不要把它缩进成代码块。
- 想显示公式效果，不要用反引号或三反引号包住公式；代码块只会展示源码。文档中的源码框是为了方便复制。
- 公式命令使用英文反斜杠 `\`，例如 `\sqrt{x}`；不要写成 `/sqrt{x}`。
- 多字符上下标要用 `{}`，例如 `x^{n+1}`，否则只有紧随 `^` 的一个字符会作为上标。
- 检查 `{}`、`\left` 与 `\right`、`\begin{...}` 与 `\end{...}` 是否成对。
- 普通文字中的美元符号可写成 `\$100`，避免被当作公式起点。
- 只写数学部分，不需要 `\documentclass`、`\usepackage` 或 `\begin{document}`。本站使用 MathJax 3 的 TeX 数学引擎；完整 LaTeX 文档和依赖未加载扩展包的命令不适用。
- 先点击“预览”，确认公式和代码正常后再保存。阅读页和个人公开页使用同一套排版规则。
