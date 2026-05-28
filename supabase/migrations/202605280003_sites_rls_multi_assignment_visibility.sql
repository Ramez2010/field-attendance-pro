drop policy if exists sites_select_scoped on public.sites;

create policy sites_select_scoped
on public.sites for select to authenticated
using (
  public.is_super_admin()
  or public.is_company_admin(company_id)
  or id = public.current_assigned_site_id()
  or exists (
    select 1
    from public.employee_site_assignments esa
    join public.employees e on e.id = esa.employee_id
    where esa.site_id = sites.id
      and public.is_employee_self(e.id)
  )
);
