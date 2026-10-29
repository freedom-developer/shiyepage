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

## 数学公式如何排版

公式使用 LaTeX 数学语法。网站在预览、保存后的阅读页和公开主页中自动用 KaTeX 排版，不需要额外安装 LaTeX，也不用运行编译命令。它负责展示公式，不会自动算出答案。

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
- 只写数学部分，不需要 `\documentclass`、`\usepackage` 或 `\begin{document}`。本站使用 KaTeX，支持常见数学命令；完整 LaTeX 文档和部分扩展宏包命令不适用。
- 先点击“预览”，确认公式和代码正常后再保存。阅读页和个人公开页使用同一套排版规则。
