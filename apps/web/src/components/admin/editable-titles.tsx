"use client";

import { AdminEditableTitle } from "@/components/admin/admin-editable-title";
import {
  adminUpdateArtistNameFieldAction,
  adminUpdateClientDisplayNameFieldAction,
  adminUpdateLotTitleFieldAction,
  adminUpdateSaleTitleFieldAction,
} from "@/lib/actions/admin/field-updates";

type TitleProps = {
  value: string;
  className?: string;
  as?: "h1" | "span";
};

export function AdminLotEditableTitle({ lotId, value, ...rest }: TitleProps & { lotId: string }) {
  return (
    <AdminEditableTitle
      value={value}
      onSave={(next) => adminUpdateLotTitleFieldAction(lotId, next)}
      {...rest}
    />
  );
}

export function AdminSaleEditableTitle({
  saleId,
  value,
  editable = true,
  ...rest
}: TitleProps & { saleId: string; editable?: boolean }) {
  return (
    <AdminEditableTitle
      value={value}
      editable={editable}
      onSave={(next) => adminUpdateSaleTitleFieldAction(saleId, next)}
      {...rest}
    />
  );
}

export function AdminArtistEditableTitle({
  artistId,
  value,
  ...rest
}: TitleProps & { artistId: string }) {
  return (
    <AdminEditableTitle
      value={value}
      onSave={(next) => adminUpdateArtistNameFieldAction(artistId, next)}
      {...rest}
    />
  );
}

export function AdminClientDisplayNameEditableTitle({
  userId,
  value,
  ...rest
}: TitleProps & { userId: string }) {
  return (
    <AdminEditableTitle
      value={value}
      onSave={(next) => adminUpdateClientDisplayNameFieldAction(userId, next)}
      {...rest}
    />
  );
}
