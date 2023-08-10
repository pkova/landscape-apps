import { Status } from '@/logic/status';
import { nestToFlag, citeToPath, useCopy } from '@/logic/utils';
import { useGroupFlag } from '@/state/groups';
import { useDelCurioMutation } from '@/state/heap/heap';
import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';

interface useCurioActionsProps {
  nest: string;
  time: string;
  refToken?: string;
}

export default function useCurioActions({
  nest,
  time,
  refToken,
}: useCurioActionsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const flag = useGroupFlag();
  const [, chFlag] = nestToFlag(nest);
  const chanPath = citeToPath({
    chan: {
      nest: `heap/${chFlag}`,
      where: `/curio/${time}`,
    },
  });
  const { doCopy, didCopy } = useCopy(refToken ? refToken : chanPath);

  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<Status>('idle');

  const delMutation = useDelCurioMutation();

  const onDelete = useCallback(async () => {
    setMenuOpen(false);
    setDeleteStatus('loading');
    delMutation.mutate(
      { flag: chFlag, time },
      {
        onSuccess: () => {
          setDeleteStatus('success');
          navigate(`/groups/${flag}/channels/heap/${chFlag}`);
        },
        onError: () => {
          setDeleteStatus('error');
        },
      }
    );
  }, [chFlag, time, delMutation, flag, navigate]);

  const onEdit = useCallback(() => {
    setMenuOpen(false);
    navigate(`/groups/${flag}/channels/heap/${chFlag}/curio/${time}/edit`, {
      state: { backgroundLocation: location },
    });
  }, [location, navigate, time, flag, chFlag]);

  const navigateToCurio = useCallback(() => {
    navigate(`/groups/${refToken}`);
  }, [navigate, refToken]);

  const onCopy = useCallback(() => {
    doCopy();
  }, [doCopy]);

  return {
    didCopy,
    menuOpen,
    setMenuOpen,
    onDelete,
    deleteStatus,
    onEdit,
    onCopy,
    navigateToCurio,
  };
}
