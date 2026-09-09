import { redirect } from 'next/navigation';

// Bare /admin has no content of its own - the Admin section's landing page
// is /admin/dashboard (see admin-shell.component.tsx's ADMIN_NAV).
export default async function Page() {
  redirect('/admin/dashboard');
}
