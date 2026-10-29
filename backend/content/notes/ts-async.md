# TypeScript 异步流程速记

异步代码的重点不是“把函数标成 `async`”，而是明确结果何时产生、错误在哪里处理，以及多个任务如何组合。

## Promise 与 async/await

`async` 函数总是返回 Promise。`await` 让当前异步函数暂停到 Promise settled，再继续执行；它不会阻塞整个页面。

```typescript
type Book = { id: string; title: string }

async function loadBook(id: string): Promise<Book> {
  const response = await fetch(`/api/books/${id}`)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return response.json() as Promise<Book>
}
```

## 并发与顺序

不依赖前一个结果的任务可以并发执行：

```typescript
const [profile, books] = await Promise.all([
  loadProfile(),
  loadBooks(),
])
```

若需要“部分成功”，可用 `Promise.allSettled`；若任务有依赖关系，则按顺序 `await`。

## 错误处理

在能采取恢复动作的边界捕获错误。不要空 catch，否则失败会悄悄消失。

```typescript
try {
  const book = await loadBook('intro-to-algorithms')
  renderBook(book)
} catch (error) {
  console.error('加载书籍失败', error)
  showRetryAction()
}
```
