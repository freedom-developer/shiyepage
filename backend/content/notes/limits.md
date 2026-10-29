# 数列极限与夹逼准则

极限描述的是数列项在指标不断增大时的趋近行为。判断时先找结构，再选择定义、比较或夹逼。

## 极限定义

数列 $a_n$ 收敛到 $L$，记作 $\lim_{n\to\infty} a_n=L$，意思是：对任意 $\varepsilon>0$，存在正整数 $N$，使得当 $n>N$ 时，$|a_n-L|<\varepsilon$。

## 夹逼准则

若从某一项开始有 $a_n\leq b_n\leq c_n$，且

$$
\lim_{n\to\infty} a_n = \lim_{n\to\infty} c_n = L,
$$

那么 $\lim_{n\to\infty} b_n=L$。

### 例：证明一个常见极限

利用 $-1\leq\cos n\leq 1$，可得

$$
-\frac{1}{n}\leq\frac{\cos n}{n}\leq\frac{1}{n}.
$$

两侧都趋于 $0$，所以

$$
\lim_{n\to\infty}\frac{\cos n}{n}=0.
$$

## 读书时的检查清单

- 不等式方向是否保持一致？
- 夹住目标数列的两侧是否都趋于同一个值？
- 若使用等价无穷小，当前运算是否允许直接替换？
