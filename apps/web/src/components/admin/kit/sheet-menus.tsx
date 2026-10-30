"use client";

import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@auction/ui/lax";
import { ChevronDown, Eye, Mail, UserMinus, Users } from "lucide-react";
import { SheetSection } from "./sheet-frame";

/**
 * A menu held open so its states can be read: an item under the pointer, a disabled one with its
 * reason, a shortcut, and the destructive item last after a separator.
 */
function OpenMenu() {
  return (
    <div className="h-[22rem]">
      <Menu open>
        <MenuTrigger asChild>
          <Button>
            Actions
            <ChevronDown aria-hidden />
          </Button>
        </MenuTrigger>
        <MenuContent
          align="start"
          side="bottom"
          avoidCollisions={false}
          className="w-72"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <MenuLabel>Northbank Gallery</MenuLabel>
          <MenuItem>
            <Eye aria-hidden />
            Open details
          </MenuItem>
          <MenuItem data-highlighted="">
            <Users aria-hidden />
            Change role
          </MenuItem>
          <MenuItem shortcut="mod+c">
            <Mail aria-hidden />
            Copy email
          </MenuItem>
          <MenuItem disabledReason="Only owners can make owners">
            <Users aria-hidden />
            Make owner
          </MenuItem>
          <MenuSeparator />
          <MenuItem tone="danger">
            <UserMinus aria-hidden />
            Remove from organisation
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

export function SheetMenus() {
  return (
    <SheetSection
      id="menus"
      title="Menus"
      description="A raised surface on the 8px menu radius with shadow md. Items sit on the 6px control radius, 32px for staff and 36px for clients; a disabled item says why under its label, and a destructive item comes last after a separator."
    >
      {() => <OpenMenu />}
    </SheetSection>
  );
}
