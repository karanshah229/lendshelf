import { router, useLocalSearchParams } from 'expo-router';
import { Star, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useMyProfile, useUid } from '@/hooks/use-auth';
import { useVisibleReviews } from '@/hooks/use-reviews';
import { useWork } from '@/hooks/use-work';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { LIMITS, type Rating } from '@/types/model';

import { isRating, RATING_LABELS, validateReview } from '@/features/reviews/review-logic';
import { StarPicker } from '@/features/reviews/Stars';
import { deleteReview, saveReview } from '@/features/shared/mutations';

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

/** Write, edit or delete my review of a Book (modal). */
export default function ReviewScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const uid = useUid();
  const { profile } = useMyProfile();
  const { work, loading: workLoading } = useWork(workId);
  const { myReview, loading: reviewsLoading } = useVisibleReviews(workId);

  const [rating, setRating] = useState<number>(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  // Prefill once from my existing review (state adjusted during render, not in an effect).
  const [prefilled, setPrefilled] = useState(false);
  if (!prefilled && !reviewsLoading) {
    setPrefilled(true);
    if (myReview) {
      setRating(myReview.rating);
      setText(myReview.text ?? '');
    }
  }

  const editing = !!myReview;
  const error = rating ? validateReview(rating, text) : null;
  const remaining = LIMITS.reviewText - text.length;

  const save = async () => {
    if (!workId || !isRating(rating) || validateReview(rating, text)) return;
    setBusy('save');
    try {
      await saveReview({
        workId,
        uid,
        authorName: profile?.name ?? 'Reader',
        rating: rating as Rating,
        text,
        exists: editing,
      });
      toast.success(editing ? 'Review updated' : 'Review posted', {
        description: 'People who have your number saved can see it.',
      });
      close();
    } catch (e) {
      toastError(e, 'Couldn’t save your review.');
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!workId) return;
    setBusy('delete');
    try {
      await deleteReview(workId, uid);
      toast.success('Review deleted');
      close();
    } catch (e) {
      toastError(e);
      setBusy(null);
    }
  };

  const loading = workLoading || (reviewsLoading && !prefilled);

  return (
    <Screen
      keyboard
      header={
        <ScreenHeader
          title={editing ? 'Edit your review' : 'Write a review'}
          back={close}
          safeTop={Platform.OS !== 'ios'}
        />
      }
    >
      {loading ? (
        <View className="items-center gap-4 pt-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-32 w-full" />
        </View>
      ) : !work ? (
        <EmptyState icon={Star} title="Book not found" />
      ) : (
        <View className="w-full max-w-xl gap-6 self-center">
          <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3">
            <BookCover uri={work.coverUrl} title={work.title} size="xs" />
            <View className="flex-1">
              <Text className="font-semibold" numberOfLines={2}>
                {work.title}
              </Text>
              {work.authors.length ? (
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {work.authors.join(', ')}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="items-center gap-2 py-2">
            <StarPicker value={rating} onChange={setRating} disabled={!!busy} />
            <Text
              className={cn(
                'text-sm font-medium',
                rating ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {isRating(rating) ? RATING_LABELS[rating] : 'Tap a star to rate'}
            </Text>
          </View>

          <View className="gap-2">
            <Label nativeID="review-text">Your thoughts (optional)</Label>
            <Textarea
              value={text}
              onChangeText={setText}
              placeholder="What did you like? Who would you recommend it to?"
              numberOfLines={8}
              maxLength={LIMITS.reviewText}
              editable={!busy}
              className="min-h-36"
              aria-labelledby="review-text"
            />
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">
                Visible to you and people who have your number saved.
              </Text>
              {remaining < 200 ? (
                <Text
                  className={cn(
                    'text-xs',
                    remaining < 0 ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {remaining}
                </Text>
              ) : null}
            </View>
            {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
          </View>

          <View className="gap-2">
            <Button size="lg" onPress={save} disabled={!isRating(rating) || !!error || !!busy}>
              <Text>{busy === 'save' ? 'Saving…' : editing ? 'Save changes' : 'Post review'}</Text>
            </Button>
            {editing ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" disabled={!!busy}>
                    <Icon as={Trash2} size={16} className="text-destructive" />
                    <Text className="text-destructive">
                      {busy === 'delete' ? 'Deleting…' : 'Delete review'}
                    </Text>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your review?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your rating and text for “{work.title}” will be removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      <Text>Cancel</Text>
                    </AlertDialogCancel>
                    <AlertDialogAction onPress={remove} className="bg-destructive">
                      <Text className="text-white">Delete</Text>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </View>
        </View>
      )}
    </Screen>
  );
}
