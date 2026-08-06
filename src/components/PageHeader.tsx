import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/Breadcrumb";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: BreadcrumbItem[];
}) {
  return (
    <div className="page-header">
      <div className="page-header__text">
        {breadcrumb?.length ? <Breadcrumb items={breadcrumb} /> : null}
        <h1 className="page-header__title">{title}</h1>
        {description ? <p className="page-header__desc">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  );
}
