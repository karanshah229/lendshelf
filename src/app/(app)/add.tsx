import { router, useLocalSearchParams } from 'expo-router';
import { BookX, PenLine, ScanBarcode, Search } from 'lucide-react-native';
import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { AddedStep } from '@/features/add/components/added-step';
import type { ScanOutcome } from '@/features/add/components/barcode-camera';
import { ConfirmStep, type SavedResult } from '@/features/add/components/confirm-step';
import { ManualPanel, type ManualPrefill } from '@/features/add/components/manual-panel';
import { ScanPanel } from '@/features/add/components/scan-panel';
import { SearchPanel } from '@/features/add/components/search-panel';
import { readBarcode } from '@/features/add/isbn';
import type { OlSearchResult } from '@/features/add/open-library';
import { initialScanQueue, scanQueueReducer, summariseScanQueue } from '@/features/add/scan-queue';
import {
  candidateFromResolved,
  parseAddMode,
  type AddCandidate,
  type AddMode,
} from '@/features/add/types';
import {
  SegmentedControl,
  type SegmentOption,
} from '@/features/library/components/segmented-control';
import { useUid } from '@/hooks/use-auth';
import { useMyItems } from '@/hooks/use-items';
import { useWork } from '@/hooks/use-work';
import { api } from '@/lib/api';
import { errorCode, errorMessage } from '@/lib/errors';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { Work, WithId } from '@/types/model';

type Origin = AddMode | 'work';

type Step =
  | { kind: 'pick' }
  | { kind: 'work' }
  | { kind: 'confirm'; candidates: AddCandidate[]; origin: Origin }
  | { kind: 'done'; result: SavedResult; origin: Origin };

const MODES: readonly SegmentOption<AddMode>[] = [
  { value: 'search', label: 'Search', icon: Search },
  { value: 'scan', label: 'Scan', icon: ScanBarcode },
  { value: 'manual', label: 'Type it in', icon: PenLine },
];

const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

const close = () => (router.canGoBack() ? router.back() : router.replace('/my-books'));

/**
 * Add books: Search (Open Library) · Scan (continuous ISBN with a review queue) · Type it in,
 * then confirm collection, visibility, format and language.
 * Params: `mode`, `workId` (add a copy of a known Book, from "I own this"), `shelfId`.
 */
export default function AddScreen() {
  const uid = useUid();
  const params = useLocalSearchParams<{ mode?: string; workId?: string; shelfId?: string }>();
  const workIdParam = param(params.workId);
  const preferredShelfId = param(params.shelfId) ?? null;

  const [mode, setMode] = useState<AddMode>(
    parseAddMode(param(params.mode)) ?? (Platform.OS === 'web' ? 'search' : 'scan')
  );
  const [step, setStep] = useState<Step>(workIdParam ? { kind: 'work' } : { kind: 'pick' });
  /** "Type it in" has unsaved text (read on Back only, so a ref). */
  const manualDraft = useRef(false);
  const onManualDraft = useCallback((has: boolean) => {
    manualDraft.current = has;
  }, []);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const [manual, setManual] = useState<{ key: number; prefill: ManualPrefill }>({
    key: 0,
    prefill: {},
  });

  const { items } = useMyItems();
  const ownedWorkIds = useMemo(() => new Set(items.map((i) => i.workId)), [items]);

  // ---------- Scan queue ----------
  const [queue, dispatch] = useReducer(scanQueueReducer, initialScanQueue);
  const queued = useRef(new Set<string>());

  const lookup = async (isbn: string) => {
    try {
      const res = await api.resolveBook({ isbn });
      dispatch({ type: 'resolved', isbn, candidate: candidateFromResolved(res, isbn) });
    } catch (e) {
      if (errorCode(e) === 'not-found') dispatch({ type: 'notFound', isbn });
      else dispatch({ type: 'failed', isbn, error: errorMessage(e) });
    }
  };

  const enqueue = (isbn: string): ScanOutcome => {
    if (queued.current.has(isbn)) return 'duplicate';
    queued.current.add(isbn);
    dispatch({ type: 'scanned', isbn });
    void lookup(isbn);
    return 'added';
  };

  const onBarcode = (data: string): ScanOutcome => {
    const read = readBarcode(data);
    return read.kind === 'isbn' ? enqueue(read.isbn) : 'notIsbn';
  };

  const removeFromQueue = (isbns: string[]) => {
    isbns.forEach((i) => queued.current.delete(i));
    dispatch({ type: 'removeMany', isbns });
  };

  // ---------- Search ----------
  const pickWork = async (r: OlSearchResult, origin: AddMode = 'search') => {
    setResolvingKey(r.workKey);
    try {
      const res = await api.resolveBook({ olWorkKey: r.workKey });
      setStep({ kind: 'confirm', candidates: [candidateFromResolved(res)], origin });
    } catch (e) {
      toastError(e, 'Couldn’t load that book. Please try again.');
    } finally {
      setResolvingKey(null);
    }
  };

  const pickIsbn = async (isbn: string) => {
    setResolvingKey(isbn);
    try {
      const res = await api.resolveBook({ isbn });
      setStep({
        kind: 'confirm',
        candidates: [candidateFromResolved(res, isbn)],
        origin: 'search',
      });
    } catch (e) {
      if (errorCode(e) === 'not-found') {
        toast('That ISBN isn’t in the catalogues. Add the details yourself.');
        openManual({ isbn });
      } else toastError(e);
    } finally {
      setResolvingKey(null);
    }
  };

  const openManual = (prefill: ManualPrefill) => {
    setManual((m) => ({ key: m.key + 1, prefill }));
    setMode('manual');
    setStep({ kind: 'pick' });
  };

  // ---------- Steps ----------
  const onSaved = (result: SavedResult, origin: Origin) => {
    if (result.isbns.length) removeFromQueue(result.isbns.filter((i) => queued.current.has(i)));
    if (origin === 'manual') setManual((m) => ({ key: m.key + 1, prefill: {} }));
    setStep({ kind: 'done', result, origin });
  };

  const backFromStep = () => {
    if (step.kind === 'confirm' && step.origin !== 'work') setStep({ kind: 'pick' });
    // F2: a full-screen task asks before throwing away what was typed (QA B17).
    else if (step.kind === 'pick' && mode === 'manual' && manualDraft.current)
      setConfirmLeave(true);
    else close();
  };

  const title =
    step.kind === 'confirm'
      ? step.candidates.length > 1
        ? `Add ${step.candidates.length} books`
        : 'Add a copy'
      : step.kind === 'done'
        ? 'Added'
        : 'Add books';

  const showPick = step.kind === 'pick';

  return (
    <Screen
      scroll={false}
      keyboard
      safeBottom={false}
      header={<ScreenHeader title={title} back={step.kind === 'done' ? close : backFromStep} />}
    >
      {/* The pick view stays mounted (hidden) so the search text and queue survive "back". */}
      <View className={cn('flex-1', !showPick && 'hidden')}>
        <View className="px-4 py-3">
          <SegmentedControl<AddMode> options={MODES} value={mode} onChange={setMode} />
        </View>
        <View className={cn('flex-1', mode !== 'search' && 'hidden')}>
          <SearchPanel
            ownedWorkIds={ownedWorkIds}
            resolvingKey={resolvingKey}
            onPickWork={(r) => void pickWork(r)}
            onPickIsbn={(i) => void pickIsbn(i)}
            onManual={openManual}
          />
        </View>
        <View className={cn('flex-1', mode !== 'scan' && 'hidden')}>
          <ScanPanel
            queue={queue}
            ownedWorkIds={ownedWorkIds}
            active={showPick && mode === 'scan'}
            onBarcode={onBarcode}
            onIsbn={enqueue}
            onRetry={(isbn) => {
              dispatch({ type: 'retry', isbn });
              void lookup(isbn);
            }}
            onRemove={(isbn) => removeFromQueue([isbn])}
            onClear={() => {
              queued.current.clear();
              dispatch({ type: 'clear' });
            }}
            onManual={(isbn) => openManual({ isbn })}
            onReview={() => {
              const candidates = summariseScanQueue(queue).readyCandidates;
              if (candidates.length) setStep({ kind: 'confirm', candidates, origin: 'scan' });
            }}
          />
        </View>
        <View className={cn('flex-1', mode !== 'manual' && 'hidden')}>
          <ManualPanel
            key={manual.key}
            prefill={manual.prefill}
            autoFocus={mode === 'manual'}
            ownedWorkIds={ownedWorkIds}
            resolvingKey={resolvingKey}
            // "Is it one of these?" picked a catalogue record instead of the typed book.
            onPickWork={(r) => void pickWork(r, 'manual')}
            onContinue={(c) => setStep({ kind: 'confirm', candidates: [c], origin: 'manual' })}
            onDraftChange={onManualDraft}
          />
        </View>
      </View>

      {step.kind === 'work' && workIdParam ? (
        <WorkStep
          uid={uid}
          workId={workIdParam}
          ownedWorkIds={ownedWorkIds}
          preferredShelfId={preferredShelfId}
          onSaved={(r) => onSaved(r, 'work')}
          onOtherWay={() => setStep({ kind: 'pick' })}
        />
      ) : null}

      {step.kind === 'confirm' ? (
        <ConfirmStep
          candidates={step.candidates}
          ownedWorkIds={ownedWorkIds}
          preferredShelfId={preferredShelfId}
          onRemove={
            step.candidates.length > 1
              ? (key) => {
                  const rest = step.candidates.filter((c) => c.key !== key);
                  setStep(rest.length ? { ...step, candidates: rest } : { kind: 'pick' });
                }
              : undefined
          }
          onSaved={(r) => onSaved(r, step.origin)}
        />
      ) : null}

      {step.kind === 'done' ? (
        <AddedStep
          result={step.result}
          onDone={close}
          onAddMore={() => setStep({ kind: 'pick' })}
        />
      ) : null}
      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this book?</AlertDialogTitle>
            <AlertDialogDescription>What you typed won’t be saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Keep editing</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onPress={() => {
                manualDraft.current = false;
                close();
              }}
            >
              <Text className="text-white">Discard</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Screen>
  );
}

function candidateFromWork(work: WithId<Work>): AddCandidate {
  return {
    key: work.id,
    workId: work.id,
    title: work.title,
    authors: work.authors,
    coverUrl: work.coverUrl,
    isCustom: work.isCustom,
    isbn: null,
    language: null,
  };
}

/** "I own this" from a Book page: confirm a copy of a known Book. */
function WorkStep({
  uid,
  workId,
  ownedWorkIds,
  preferredShelfId,
  onSaved,
  onOtherWay,
}: {
  uid: string;
  workId: string;
  ownedWorkIds: ReadonlySet<string>;
  preferredShelfId: string | null;
  onSaved(r: SavedResult): void;
  onOtherWay(): void;
}) {
  const { work, loading, error } = useWork(workId);
  const candidates = useMemo(() => (work ? [candidateFromWork(work)] : []), [work]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }
  // Hand-entered books belong to whoever typed them in; others add their own.
  if (!work || error || (work.isCustom && work.createdBy !== uid)) {
    return (
      <EmptyState
        icon={BookX}
        title="Can’t add this book from here"
        description="Search for it, scan its barcode, or type in the details to add your copy."
      >
        <Button onPress={onOtherWay}>
          <Text>Add it another way</Text>
        </Button>
      </EmptyState>
    );
  }
  return (
    <ConfirmStep
      candidates={candidates}
      ownedWorkIds={ownedWorkIds}
      preferredShelfId={preferredShelfId}
      onSaved={onSaved}
    />
  );
}
