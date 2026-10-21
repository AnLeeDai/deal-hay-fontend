## Next.js Development Rules

Phát triển project theo hướng **Server-First Architecture**, áp dụng tối đa các nguyên lý và best practices chính thức của Next.js App Router.

Next.js documentation:

https://nextjs.org/docs

UI components:

https://ui.shadcn.com/docs/components

---

## 1. Kiến trúc tổng thể

Frontend sử dụng **Next.js App Router react hook form validate form**.

Backend là một API độc lập được viết bằng **Laravel**.

Next.js frontend gọi **trực tiếp Laravel Backend API**.

Không xây dựng thêm proxy API bằng:

```text
app/api/*
```

hoặc Next.js Route Handler chỉ để forward request sang Laravel.

Luồng dữ liệu chuẩn:

```text
Browser
   ↓
Next.js Server Component
   ↓
Module Container
   ↓
API Layer
   ↓
Laravel Backend API
```

Đối với mutation:

```text
Client interaction
   ↓
Server Action
   ↓
API Layer
   ↓
Laravel Backend API
```

Next.js không đóng vai trò API Gateway hoặc proxy cho Laravel.

---

## 2. Server-First Architecture

Ưu tiên tối đa xử lý phía server.

Mặc định component phải là **Server Component**.

Ưu tiên sử dụng:

- Server Components
- Server-side data fetching
- Server Actions
- server-side validation
- server-side data transformation
- caching
- revalidation
- Suspense / streaming khi phù hợp

Chỉ sử dụng:

```ts
"use client";
```

khi thực sự bắt buộc.

Ví dụ:

- `useState`
- `useEffect`
- `useRef`
- `onClick`
- `onChange`
- browser APIs
- client-only library
- interactive UI bắt buộc chạy trong browser

Không thêm `"use client"` vào:

- `page.tsx`
- `layout.tsx`
- container
- toàn bộ module

chỉ vì một component con cần interaction.

Luôn đẩy Client Component xuống boundary nhỏ nhất có thể.

Ví dụ:

```text
ArticlePage           Server
      ↓
ArticleContainer      Server
      ↓
ArticleCard           Server
      ↓
ArticleActions        Client
```

Chỉ `ArticleActions` sử dụng `"use client"`.

---

## 3. Data Fetching

Toàn bộ initial data phải được fetch từ phía server.

Không fetch initial data bằng:

- `useEffect`
- client-side `fetch`
- client-side Axios
- TanStack Query / React Query

nếu Server Component có thể thực hiện.

Ví dụ:

```tsx
export async function ArticleListContainer() {
  const articles = await getArticles();

  return <ArticleList articles={articles} />;
}
```

Trong đó:

```text
getArticles()
      ↓
Laravel Backend API
```

Laravel API được gọi trực tiếp từ Next.js server.

Không đi qua:

```text
/api/articles
```

của Next.js.

---

## 4. Mutation

Các request:

- POST
- PUT
- PATCH
- DELETE

ưu tiên thực hiện thông qua **Server Actions**.

Ví dụ:

```text
Form
 ↓
Server Action
 ↓
api/articles/mutations.ts
 ↓
Laravel API
```

Sau mutation sử dụng khi phù hợp:

```ts
revalidatePath();
revalidateTag();
redirect();
```

Không chuyển toàn bộ page/container thành Client Component chỉ để submit dữ liệu.

---

## 5. Folder Structure

Sử dụng cấu trúc:

```text
src/
├── app/
├── modules/
├── api/
├── components/
├── config/
├── lib/
└── types/
```

---

## 6. `app/`

`app/` chỉ chịu trách nhiệm chính cho:

- routing
- pages
- layouts
- metadata
- loading
- error boundaries
- not-found
- route-level composition

Ví dụ:

```text
app/
├── articles/
│   ├── page.tsx
│   ├── loading.tsx
│   ├── error.tsx
│   │
│   └── [id]/
│       └── page.tsx
│
└── layout.tsx
```

Không đặt business logic lớn trong `page.tsx`.

Page chủ yếu gọi container:

```tsx
import { ArticleListContainer } from "@/modules/articles/containers/article-list-container";

export default function ArticlesPage() {
  return <ArticleListContainer />;
}
```

Không sử dụng:

```text
app/api/*
```

để proxy Laravel API.

Chỉ tạo Route Handler nếu một feature thực sự yêu cầu endpoint thuộc riêng Next.js và không phải proxy backend.

---

## 7. `modules/`

Mỗi feature chia thành một module riêng.

Ví dụ:

```text
modules/
└── articles/
    ├── containers/
    │   ├── article-list-container.tsx
    │   └── article-detail-container.tsx
    │
    ├── components/
    │   ├── article-list.tsx
    │   ├── article-card.tsx
    │   └── article-actions.tsx
    │
    ├── actions/
    │   ├── create-article.ts
    │   ├── update-article.ts
    │   └── delete-article.ts
    │
    ├── schemas/
    │   └── article.schema.ts
    │
    └── utils/
```

---

## 8. Container

Container chịu trách nhiệm:

- gọi API layer
- orchestration
- business logic
- chuẩn bị dữ liệu
- transform dữ liệu
- ghép các component nhỏ
- xử lý dữ liệu trước khi truyền xuống UI

Container mặc định là Server Component.

Ví dụ:

```tsx
export async function ArticleListContainer() {
  const articles = await getArticles();

  return <ArticleList articles={articles} />;
}
```

Không thêm `"use client"` vào container nếu không thực sự bắt buộc.

---

## 9. Component

Component bên trong module chủ yếu chịu trách nhiệm presentation.

Ví dụ:

```text
ArticleListContainer
        ↓
ArticleList
        ↓
ArticleCard
```

Không fetch backend API trong presentational component.

Không để nhiều child component tự fetch cùng một resource nếu container có thể fetch một lần và truyền xuống qua props.

---

## 10. API Layer

Tất cả giao tiếp với Laravel Backend API phải nằm trong:

```text
api/
```

Ví dụ:

```text
api/
├── articles/
│   ├── routes.ts
│   ├── queries.ts
│   ├── mutations.ts
│   └── types.ts
│
├── categories/
│   ├── routes.ts
│   ├── queries.ts
│   ├── mutations.ts
│   └── types.ts
│
└── users/
    ├── routes.ts
    ├── queries.ts
    ├── mutations.ts
    └── types.ts
```

Folder `api/` ở đây là **API client layer của frontend**, không phải Next.js API Route.

---

## 11. `routes.ts`

`routes.ts` chỉ định nghĩa endpoint của Laravel Backend API.

Ví dụ:

```ts
export const articleRoutes = {
  list: "/articles",
  detail: (id: string) => `/articles/${id}`,
  create: "/articles",
  update: (id: string) => `/articles/${id}`,
  delete: (id: string) => `/articles/${id}`,
};
```

Không hardcode endpoint Laravel rải rác trong project.

---

## 12. `queries.ts`

Chứa các request đọc dữ liệu:

```text
GET
```

Ví dụ:

```ts
export async function getArticles() {}

export async function getArticleById(id: string) {}
```

Các function này gọi trực tiếp Laravel Backend API.

Ưu tiên chỉ sử dụng chúng từ Server Component, container hoặc server-side logic.

---

## 13. `mutations.ts`

Chứa:

```text
POST
PUT
PATCH
DELETE
```

Ví dụ:

```ts
export async function createArticle() {}

export async function updateArticle() {}

export async function deleteArticle() {}
```

Các function gọi trực tiếp Laravel API.

Không đặt request logic trực tiếp trong UI component.

---

## 14. `types.ts`

Định nghĩa chính xác request/response type của Laravel API.

Ví dụ:

```ts
export interface Article {
  id: string;
  attributes: ArticleAttributes;
}

export interface ArticleAttributes {
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}
```

Không sử dụng:

```ts
any
```

Không tự suy đoán response nếu backend contract đã tồn tại.

---

## 15. Environment Variables

Mọi configuration phải được đưa vào:

```text
.env
.env.local
```

Không hardcode:

- Laravel API URL
- backend URL
- application URL
- API key
- secret
- authentication configuration
- third-party URL
- configuration theo environment

Ví dụ:

```env
NEXT_PUBLIC_API=http://localhost:8000/api
```

API layer sử dụng:

```ts
process.env.NEXT_PUBLIC_API
```

Không viết:

```ts
fetch("http://localhost:8000/api/articles");
```

---

## 16. `.env` và `.env.local`

`.env`:

Dùng cho configuration chung nếu phù hợp.

`.env.local`:

Dùng cho:

- local configuration
- secrets
- API keys
- token
- environment-specific configuration

`.env.local` không được commit lên repository.

---

## 17. Không expose backend config xuống browser

Data fetching chạy server-side. Cấu hình Laravel Backend URL hiện dùng `NEXT_PUBLIC_API` và module `config/env.ts` được bảo vệ bằng `server-only`.

Ví dụ:

```env
NEXT_PUBLIC_API=http://localhost:8000/api
```

Prefix `NEXT_PUBLIC_` khiến Next.js thay giá trị trực tiếp vào mã khi build. URL này không được chứa secret. Khi đổi URL phải build và deploy lại; không import module `config/env.ts` vào Client Component.

Ưu tiên để request xảy ra:

```text
Next.js Server
      ↓
Laravel API
```

thay vì:

```text
Browser
      ↓
Laravel API
```

để giữ kiến trúc Server-First.

---

## 18. Centralized Environment Config

Không sử dụng `process.env` rải rác toàn project.

Tạo:

```text
config/
└── env.ts
```

Ví dụ:

```ts
import "server-only";

export const env = {
  backendApiUrl: process.env.NEXT_PUBLIC_API!,
};
```

Sau đó API layer sử dụng:

```ts
import { env } from "@/config/env";
```

---

## 19. Server-only

Những module chứa:

- Laravel backend URL
- secrets
- token
- authentication server logic
- private environment variables

nên sử dụng:

```ts
import "server-only";
```

khi phù hợp.

Không import các module server-only vào Client Component.

---

## 20. shadcn/ui

Toàn bộ UI/UX phải ưu tiên component chính thức từ:

https://ui.shadcn.com/docs/components

Nếu shadcn/ui đã có component tương ứng thì phải sử dụng component đó.

Ví dụ:

- Button
- Card
- Input
- Form
- Dialog
- Alert Dialog
- Dropdown Menu
- Select
- Table
- Tabs
- Sheet
- Badge
- Pagination
- Skeleton
- Breadcrumb

Nếu component chưa được cài trong project thì cài bằng shadcn CLI.

Ví dụ:

```bash
npx shadcn@latest add button
```

Không tự tạo component thay thế nếu shadcn/ui đã có.

---

## 21. Styling

Tuyệt đối hạn chế custom CSS.

Không tự ý:

- đổi màu
- thêm gradient
- custom shadow
- thay border radius
- thay typography
- custom animation
- override CSS
- tạo custom variant
- redesign shadcn/ui

nếu task không yêu cầu rõ ràng.

UI phải giữ nguyên design language của shadcn/ui.

---

## 22. Tailwind CSS

Tailwind chỉ chủ yếu dùng cho layout/composition như:

- flex
- grid
- gap
- spacing layout
- width
- height
- responsive
- positioning
- alignment

Ví dụ:

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
```

Không sử dụng Tailwind để tự redesign shadcn component.

---

## 23. Shared Components

```text
components/
├── ui/
├── layout/
└── shared/
```

`components/ui/` chứa các component được shadcn CLI sinh ra.

Ví dụ:

```text
components/ui/button.tsx
components/ui/card.tsx
components/ui/dialog.tsx
```

Business-specific component không được đặt trong `components/ui`.

Ví dụ:

```text
ArticleCard
```

phải nằm trong:

```text
modules/articles/components/article-card.tsx
```

---

## 24. Client Component Rules

Client Component phải nhỏ nhất có thể.

Không biến component thành Client Component chỉ để:

- fetch data
- map array
- format dữ liệu
- gọi helper
- conditional rendering
- xử lý business logic

Các việc trên ưu tiên xử lý server-side.

---

## 25. Forms

Ưu tiên:

```text
Form
 ↓
Server Action
 ↓
Validation
 ↓
API Mutation
 ↓
Laravel Backend
```

Nếu cần client-side validation hoặc interaction để cải thiện UX thì chỉ biến phần form cần thiết thành Client Component.

Laravel backend và server-side layer vẫn phải validate dữ liệu.

---

## 26. Next.js Native Features

Ưu tiên tận dụng:

- Server Components
- Server Actions
- `loading.tsx`
- `error.tsx`
- `not-found.tsx`
- Suspense
- streaming
- Metadata API
- `next/image`
- `next/font`
- `redirect`
- `notFound`
- `revalidatePath`
- `revalidateTag`
- caching

Không chuyển logic sang client nếu Next.js có giải pháp server-side phù hợp.

---

## 27. Architecture Priority

Khi có nhiều cách triển khai, ưu tiên:

```text
Server Component
       ↓
Server-side function
       ↓
API Layer
       ↓
Laravel Backend
```

Với mutation:

```text
Small Client Interaction
       ↓
Server Action
       ↓
API Layer
       ↓
Laravel Backend
```

Client-side là lựa chọn cuối cùng.

---

## 28. Restrictions

Không được tự ý:

- tạo Next.js API proxy cho Laravel
- tạo `app/api/*` chỉ để forward request
- fetch initial data từ browser
- thêm `"use client"` không cần thiết
- hardcode Laravel API URL
- hardcode API endpoint
- expose secret bằng `NEXT_PUBLIC_*`
- sử dụng `any`
- viết business logic trong UI component
- fetch API trong presentational component
- duplicate API logic
- redesign shadcn/ui
- custom CSS không cần thiết
- tạo custom component khi shadcn/ui đã có component tương ứng

---

## 29. Mục tiêu cuối cùng

Implementation phải hướng tới:

- Server-side tối đa
- Client-side tối thiểu
- JavaScript gửi xuống browser tối thiểu
- Next.js Server Component gọi trực tiếp Laravel Backend API
- không sử dụng Next.js làm proxy API
- API layer tập trung
- module-based architecture
- type-safe
- configuration qua `.env` / `.env.local`
- không hardcode
- không expose secret
- separation of concerns rõ ràng
- dễ maintain
- dễ scale
- tận dụng tối đa Next.js App Router
- giữ nguyên UI/UX của shadcn/ui

Nếu có nhiều giải pháp, luôn chọn giải pháp phù hợp nhất với **Server-First Architecture**.

---

## 30. Deploy trên Vercel

Import repository frontend vào Vercel và cấu hình biến sau trong Settings → Environment Variables cho môi trường Preview và Production:

```env
NEXT_PUBLIC_API=https://your-api-host.onrender.com/api
```

Tên biến phải đúng là `NEXT_PUBLIC_API`, giá trị là URL HTTP API của Laravel có hậu tố `/api`. Không dùng localhost trong Preview hoặc Production. `.env.local` chỉ cấu hình máy local và không được commit; nó không thiết lập biến cho Vercel. Vì giá trị `NEXT_PUBLIC_API` được thay vào mã khi build, sau khi sửa biến phải Redeploy để tạo deployment mới.

Trước khi deploy frontend, kiểm tra `GET https://your-api-host.onrender.com/api/` trả JSON trang chủ với HTTP 200. `/up` trả 200 chưa đủ để xác nhận Laravel API hoạt động: nếu nó trả `{"health":"OK"}` và `/api/*` trả `Not found.`, traffic có thể đang đi vào Laravel Reverb. Trên Render, chỉ HTTP server được nghe cổng công khai; Reverb phải nghe nội bộ và đi qua Caddy.

Nếu frontend nằm trong monorepo, đặt Vercel Root Directory là `deal-hay-fontend`. Build command và output directory giữ mặc định của Next.js.

## 31. Quảng cáo Adsterra

Quảng cáo dùng ba mã Adsterra đã cấp: Social Bar, Popunder và Native Banner. URL và mã container được quản lý tập trung tại `src/config/advertising.ts`. Giữ nguyên URL và các thuộc tính của mã được cấp, gồm `data-cfasync="false"`; Native Banner giữ `async`. Xem [hướng dẫn tích hợp chính thức](https://help-publishers.adsterra.com/en/articles/5210780-adding-ads-to-a-static-html-site) và [lưu ý Cloudflare Rocket Loader](https://help-publishers.adsterra.com/en/articles/5213852-using-adsterra-ads-with-cloudflare).

Các script quảng cáo chỉ hoạt động trên trang chủ, gian hàng và chi tiết sản phẩm sau khi người dùng đồng ý. Popunder được thêm một lần vào cuối `head`; Social Bar được thêm một lần ở cuối `body`. Native Banner dùng một container duy nhất trong layout mua sắm, giữ nguyên khi chuyển giữa các trang mua sắm và không tự tải lại quảng cáo theo route hoặc bộ đếm thời gian. Không lặp cùng mã Native Banner trên một trang; nếu cần vị trí khác, yêu cầu mã bổ sung từ Adsterra. Tần suất Popunder, tần suất và vị trí Social Bar do Adsterra cấu hình qua hỗ trợ.

Adsterra không cung cấp callback xác nhận xem hoàn tất cho ba mã này. [Điều khoản publisher](https://adsterra.com/publishers-terms-managed/) hạn chế traffic có thưởng. Chương trình mã vận chuyển bên dưới mặc định tắt; cần xác nhận cách sử dụng với nhà cung cấp trước khi bật trong môi trường vận hành. Thao tác **Xem** của website không xác nhận lượt xem, lượt click quảng cáo đối tác hay doanh thu Adsterra.

Hộp lựa chọn quảng cáo cho phép đồng ý hoặc từ chối trước khi tải script. Cookie `deal-hay-advertising-consent` lưu `v1:accepted` hoặc `v1:declined` trong 180 ngày. Người dùng có thể mở lại lựa chọn qua nút **Tùy chọn cookie quảng cáo**; rút lại đồng ý tải lại trang để dừng các script đã khởi tạo. Khi quay lại một tab hoặc tài liệu được khôi phục từ lịch sử, hệ thống đối chiếu cookie và tải lại nếu lựa chọn đã đổi ở nơi khác. Chính sách tại `/privacy` giải thích dữ liệu quảng cáo và dẫn đến [chính sách bảo mật Adsterra](https://adsterra.com/privacy-policy-managed/) cùng [chính sách cookie](https://adsterra.com/cookies/).

Các trang mua sắm và các trang chức năng còn lại sử dụng hai root layout riêng. Chuyển giữa hai nhóm tải lại toàn bộ tài liệu, giúp script quảng cáo kết thúc trước khi vào trang tài khoản, đăng nhập, quản trị, tin nhắn hoặc quản lý đơn hàng. Đây là cách triển khai cho vòng đời Next.js; Adsterra không có hướng dẫn SPA riêng trong các tài liệu đã đối chiếu.

Không thể đọc trực tiếp hai trang tài khoản [Websites](https://beta.publishers.adsterra.com/websites) và [FAQ](https://beta.publishers.adsterra.com/faq) trong môi trường nghiên cứu. Trước khi vận hành, đăng nhập dashboard để xác nhận đúng tên miền đã được duyệt và cả ba ad unit ở trạng thái Active; kiểm tra lại mã bằng Get code. Theo [hướng dẫn quản lý website](https://help-publishers.adsterra.com/en/articles/5056395-managing-your-websites), ad unit không dùng quá 14 ngày có thể thành inactive và cần Resubmit. Hướng dẫn tích hợp chính thức xác nhận Adsterra không yêu cầu `ads.txt`; nếu cần khai báo người bán cho mục đích khác, lấy thông tin từ hỗ trợ thay vì tự tạo publisher ID.

Chạy `npm run test:ads` để kiểm tra mã tích hợp, chống tải trùng, lựa chọn cookie và ranh giới trang mua sắm/tài khoản. Kiểm thử mô phỏng script và không tạo lượt xem hay click quảng cáo thật.

## 32. Phí vận chuyển Hà Nội

Chủ shop cấu hình tại **Kênh người bán → Cửa hàng → Phí vận chuyển Hà Nội**. Có thể nhập phí mặc định và mức riêng cho từng phường/xã; mức riêng thay thế phí mặc định. Tính năng mặc định tắt và chỉ tính phí sau khi shop lưu cấu hình, bật áp dụng.

Khi khách chọn địa chỉ đặt hàng, frontend lấy báo phí từ backend theo sản phẩm và phường/xã. Địa chỉ Hà Nội dùng mức phí shop đã bật. Với địa chỉ ngoài Hà Nội hoặc shop chưa cấu hình, giao diện ghi rõ phí cần trao đổi với shop và chỉ hiển thị tiền hàng sau giảm. Phí được cộng riêng với tiền hàng; mã giảm giá sản phẩm hiện có tiếp tục chỉ giảm tiền hàng. Nếu phí đổi trước khi đặt, backend yêu cầu tải lại báo phí thay vì âm thầm tính giá khác.

Hộp đặt hàng có ô nhập mã sản phẩm và nút **Miễn phí vận chuyển**. Mã sản phẩm nhập phải thuộc tài khoản và sản phẩm đang đặt; mã chưa lưu được lưu qua API trước khi chọn.

Khi backend bật `SHIPPING_REWARDS_ENABLED=true` và shop đã bật phí giao hàng, **Miễn phí vận chuyển** mở khu vực quảng cáo Adsterra hiện có. Native Banner được chuyển tạm vào hộp đặt hàng và trả về vị trí cũ khi đóng, giữ một container và một bộ script. Khách cần đồng ý cookie và chờ quảng cáo tải trước khi nút **Xem** khả dụng; quảng cáo trống hoặc bị chặn không mở khóa nút. Mở khu vực quảng cáo chỉ tạo phiên, chưa cấp mã. Bấm **Xem** gửi yêu cầu đổi mã đến backend; đây là thao tác ưu đãi nội bộ, không phải xác nhận hoàn tất quảng cáo từ Adsterra.

Mã giảm 100% phí ship được lưu theo tài khoản và sản phẩm, tự khôi phục khi mở lại hộp đặt hàng, mặc định hết hạn sau 7 ngày. Mã dùng một lần cho phí giao hàng Hà Nội do shop báo; phí bằng 0 hoặc chưa xác định thì giữ mã. Khách có thể bỏ chọn mã và kết hợp với mã giảm tiền hàng. Backend xác thực mã và tính tổng, chống dùng lại hoặc cấp trùng khi thử lại yêu cầu.

Chạy migration backend trước khi triển khai frontend mới: `php artisan migrate --force`. Kiểm tra báo phí, cấu hình và checkout bằng `node --test tests/public-shipping-quote.test.mjs tests/shop-shipping-settings.test.mjs tests/discount-code-actions.test.mjs tests/shipping-reward-actions.test.mjs`.
